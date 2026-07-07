/**
 * Scan loop — the bot's polling heartbeat (fallback when streaming is off).
 */
import type { BotSettingsRecord } from '../types/db';
import type { RiskLevel, Timeframe, TradeAction, TradeSignal } from '@autotrade/shared';
import {
  resolveStrategyLists,
  mustUsePaperSimulator,
  maxExecutionsPerDay,
  maxPaperBalance,
} from '@autotrade/shared';
import * as db from '../lib/supabase-db';
import { analyzeSymbol } from '../services/analysis/index';
import type { RiskDecision } from '../services/risk/index';
import { runStrategyEngine } from '../services/strategy-engine';
import { loadScanOverlayContext } from '../services/strategy-engine/contextBuilder';
import type { TradingMode } from '../services/strategy-engine/types';
import type { StrategyDecision } from '../services/strategy-engine/types';
import {
  monitorUserOpenTrades,
  monitorUserBrokerTrades,
  openPaperTrade,
  openBrokerTrade,
  openLiveTrade,
  markToMarketUserFromQuotes,
  type EntrySnapshot,
} from '../services/execution/paper.engine';
import { loadUserBroker } from '../lib/broker-credentials';
import {
  canUsePaperTrading,
  countPaperTrades,
  isProEntitled,
} from '../middleware/subscription';
import { isStockMarketOpen } from '../lib/alpaca';
import { minutesSinceMidnightEastern } from '../lib/market-hours';
import { isCryptoSymbol } from '../services/marketdata/alpaca.provider';
import { getMarketDataForUser } from '../services/marketdata/index';

let timer: NodeJS.Timeout | null = null;
let running = false;


const lastSignal = new Map<string, { action: string; ts: number }>();
const SIGNAL_DEDUP_MS = 60_000;

function engineModeFromRiskLevel(riskLevel: RiskLevel, paper: boolean): TradingMode {
  // Paper mode should explore setups — conservative presets block almost all entries.
  if (paper) return riskLevel === 'HIGH' ? 'aggressive' : 'balanced';
  if (riskLevel === 'LOW') return 'conservative';
  if (riskLevel === 'HIGH') return 'aggressive';
  return 'balanced';
}



async function stockMarketOpenForUser(clerkId: string): Promise<boolean> {
  try {
    const cred = await db.getDecryptedBrokerKeys(clerkId, true);
    if (cred?.provider === 'alpaca') {
      return isStockMarketOpen({ keyId: cred.keyId, secret: cred.secret, paper: cred.paper });
    }
  } catch {
    /* use server clock fallback */
  }
  return isStockMarketOpen();
}

async function persistSignal(clerkId: string, signal: TradeSignal): Promise<string> {
  return db.createSignal({
    clerkId,
    ticker: signal.ticker,
    exchange: signal.exchange,
    price: signal.price,
    timeframe: signal.timeframe,
    strategy: signal.strategy,
    action: signal.action,
    confidence: signal.confidence,
    riskLevel: signal.riskLevel,
    entryReason: signal.entryReason,
    stopLoss: signal.stopLoss ?? undefined,
    takeProfit: signal.takeProfit ?? undefined,
    rrRatio: signal.rrRatio ?? undefined,
    explanation: signal.explanation,
    createdAt: signal.createdAt,
  });
}

function riskLevelFor(atrPct: number): RiskLevel {
  if (atrPct >= 4) return 'HIGH';
  if (atrPct >= 1.5) return 'MEDIUM';
  return 'LOW';
}

function decisionToTradeSignal(decision: StrategyDecision, entryTf: Timeframe): TradeSignal {
  const action: TradeAction =
    decision.action === 'BUY'
      ? 'BUY'
      : decision.action === 'SHORT'
        ? 'SELL'
        : decision.action === 'HOLD'
          ? 'HOLD'
          : decision.chosenStrategy && decision.confidence > 0
            ? 'AVOID'
            : 'HOLD';

  const entry = decision.riskPlan;
  const strategyLabel =
    decision.chosenStrategy?.internalName ??
    decision.chosenStrategy?.displayName ??
    'strategy_engine';

  return {
    ticker: decision.symbol,
    exchange: decision.exchange,
    createdAt: decision.timestamp,
    price: decision.price,
    timeframe: entryTf,
    strategy: strategyLabel,
    action,
    confidence: decision.confidence,
    riskLevel: riskLevelFor(0),
    entryReason: decision.entrySignal ?? decision.reasoning.slice(0, 280),
    stopLoss: entry?.stopLoss ?? null,
    takeProfit: entry?.takeProfit ?? null,
    rrRatio: entry?.rrRatio ?? null,
    explanation: decision.reasoning,
  };
}

export interface UserBotContext {
  clerkId: string;
  settings: BotSettingsRecord;
  stockStrategies: string[];
  cryptoStrategies: string[];
  includeExperimental: boolean;
  equity: number;
  pnlToday: number;
  timeframes: Timeframe[];
  watchlist: Array<{ symbol: string; exchange: string }>;
}

function riskLevelFromAnalysis(analysis: Awaited<ReturnType<typeof analyzeSymbol>>, entryTf: Timeframe): RiskLevel {
  const price = analysis[entryTf]?.snapshot.price ?? 0;
  const atr = analysis[entryTf]?.snapshot.atr14 ?? 0;
  const atrPct = price > 0 ? (atr / price) * 100 : 0;
  return riskLevelFor(atrPct);
}

export async function loadUserBotContext(
  clerkId: string,
  options?: { manualScan?: boolean },
): Promise<UserBotContext | null> {
  const user = await db.getBotContext(clerkId);
  if (!user || user.status === 'DISABLED' || !user.botSettings) {
    return null;
  }
  if (user.botSettings.mode === 'DISABLED' && !options?.manualScan) {
    return null;
  }

  const botSettings =
    options?.manualScan && user.botSettings.mode === 'DISABLED'
      ? { ...user.botSettings, mode: 'PAPER' as const }
      : user.botSettings;

  const isLiveMode = botSettings.mode === 'LIVE';
  if (isLiveMode && !user.liveEntitled) return null;

  const paperOnly = mustUsePaperSimulator(user.role, user.subscription, user.email, user.founderPlanOverride ?? null);

  if (!isLiveMode) {
    const [paperTradeCount, openPaperTrades] = await Promise.all([
      countPaperTrades(clerkId),
      db.countOpenTrades(clerkId, 'PAPER'),
    ]);
    const canPaper =
      canUsePaperTrading(user.role, user.subscription, paperTradeCount, user.email) || openPaperTrades > 0;
    if (!canPaper) return null;
  }

  let equity = user.paperAccount?.equity ?? user.paperAccount?.balance ?? 0;
  if (!isLiveMode && paperOnly) {
    const cap = maxPaperBalance(user.role, user.subscription, user.email);
    if (equity > cap) equity = cap;
  }
  const broker = await loadUserBroker(clerkId, !isLiveMode);
  const brokerMatchesMode = broker
    ? isLiveMode
      ? broker.mode === 'live'
      : broker.mode === 'paper'
    : false;
  if (brokerMatchesMode) {
    try {
      const account = await broker!.getAccount();
      equity = account.equity ?? account.buyingPower ?? equity;
    } catch {
      /* keep internal paper equity when broker is unreachable */
    }
  }

  return {
    clerkId,
    settings: botSettings,
    ...resolveStrategyLists(botSettings),
    includeExperimental: botSettings.includeExperimental ?? false,
    equity,
    pnlToday: await db.realizedPnlToday(clerkId),
    timeframes: botSettings.timeframes as Timeframe[],
    watchlist: user.watchlist.map(({ symbol, exchange }) => ({ symbol, exchange })),
  };
}

export interface ScanCycleResult {
  ok: boolean;
  reason?: string;
  symbolsScanned: number;
  stockSymbols: number;
  cryptoSymbols: number;
  skippedMarketClosed: number;
  skippedRateLimit?: number;
  /** BUY/SHORT decisions that reached the execution gate this cycle. */
  actionableEntries?: number;
  /** Why approved entries did not open (broker error, position already open, etc.). */
  executionFailures?: string[];
}

export async function evaluateSymbolEntry(
  ctx: UserBotContext,
  symbol: string,
  exchange: string,
  md?: Awaited<ReturnType<typeof import('../services/marketdata/index').getMarketDataForUser>>,
): Promise<{ actionable: boolean; failure?: string }> {
  const { clerkId, settings } = ctx;
  const isLive = settings.mode === 'LIVE';

  if (!isCryptoSymbol(symbol) && !(await stockMarketOpenForUser(clerkId))) {
    return { actionable: false };
  }

  const tradeMode = isLive ? 'LIVE' : 'PAPER';
  const openCount = await db.countOpenTrades(clerkId, tradeMode);

  const analysis = await analyzeSymbol(symbol, ctx.timeframes, md);
  if (Object.keys(analysis).length === 0) {
    return { actionable: false };
  }

  const crypto = isCryptoSymbol(symbol);
  const enabled = crypto ? ctx.cryptoStrategies : ctx.stockStrategies;

  const overlayCtx = md
    ? await loadScanOverlayContext(md, symbol, analysis)
    : { market: undefined, crypto: undefined, liquidity: undefined };

  const paperMode = settings.mode === 'PAPER';
  const engineMinConfidence = paperMode
    ? Math.min(settings.minConfidence, 50)
    : settings.minConfidence;

  const { decision, context: stratCtx } = runStrategyEngine({
    symbol,
    exchange,
    analysis,
    config: {
      mode: engineModeFromRiskLevel(settings.riskLevel as RiskLevel, paperMode),
      minConfidence: engineMinConfidence,
      enabledStrategies: enabled.length > 0 ? enabled : 'all',
      disabledStrategies: settings.disabledStrategies ?? [],
      includeExperimental: ctx.includeExperimental,
    },
    account: {
      equity: ctx.equity,
      openTradeCount: openCount,
      realizedPnlToday: ctx.pnlToday,
      nowMinutes: minutesSinceMidnightEastern(),
    },
    riskSettings: {
      mode: settings.mode,
      maxActiveTrades: settings.maxActiveTrades,
      maxTradeSize: settings.maxTradeSize,
      riskPerTradePct: settings.riskPerTradePct,
      maxDailyLoss: settings.maxDailyLoss,
      tradingHoursStart: settings.tradingHoursStart,
      tradingHoursEnd: settings.tradingHoursEnd,
    },
    riskLevel: settings.riskLevel as RiskLevel,
    defaultStopPct: settings.defaultStopPct,
    defaultTakeProfitPct: settings.defaultTakeProfitPct,
    market: overlayCtx.market,
    crypto: overlayCtx.crypto,
    liquidity: overlayCtx.liquidity,
  });

  const signal = decisionToTradeSignal(decision, stratCtx.entryTf);
  signal.riskLevel = riskLevelFromAnalysis(analysis, stratCtx.entryTf);

  const isActionable = decision.action === 'BUY' || decision.action === 'SHORT';
  const sigKey = `${clerkId}:${symbol}`;
  const prev = lastSignal.get(sigKey);
  const decisionChanged =
    !prev || prev.action !== signal.action || Date.now() - prev.ts > SIGNAL_DEDUP_MS;

  let signalRowId: string | null = null;
  if (decisionChanged) {
    signalRowId = await persistSignal(clerkId, signal);
    lastSignal.set(sigKey, { action: signal.action, ts: Date.now() });
    const cutoff = Date.now() - SIGNAL_DEDUP_MS * 10;
    for (const [k, v] of lastSignal) {
      if (v.ts < cutoff) lastSignal.delete(k);
    }
  }

  if (!isActionable || !decision.riskPlan || decision.blocked || !decision.side) {
    return { actionable: false };
  }

  const alreadyOpen = await db.findOpenTradeBySymbol(clerkId, symbol, tradeMode);
  if (alreadyOpen) {
    return {
      actionable: true,
      failure: `${symbol}: position already open`,
    };
  }

  if (!signalRowId) signalRowId = await persistSignal(clerkId, signal);

  const risk: Extract<RiskDecision, { approved: true }> = {
    approved: true,
    qty: decision.riskPlan.qty,
    side: decision.side,
    stopLoss: decision.riskPlan.stopLoss,
    takeProfit: decision.riskPlan.takeProfit,
  };

  const snap = analysis[stratCtx.entryTf]?.snapshot;
  const entrySnapshot: EntrySnapshot = {
    price: signal.price,
    atr14: snap?.atr14 ?? 0,
    rsi14: snap?.rsi14 ?? 0,
    volume: snap?.volume ?? 0,
    avgVolume: snap?.avgVolume ?? 0,
    rrRatio: signal.rrRatio,
  };

  const botUser = await db.getBotContext(clerkId);
  if (botUser) {
    const openedToday = await db.countTradesOpenedSince(clerkId);
    const maxExec = maxExecutionsPerDay(botUser.role, botUser.subscription, botUser.email);
    if (maxExec != null && openedToday >= maxExec) {
      return { actionable: true, failure: `${symbol}: daily execution limit reached` };
    }
  }

  if (isLive) {
    const broker = await loadUserBroker(clerkId, false);
    if (!broker) {
      return { actionable: true, failure: `${symbol}: LIVE mode but no live Alpaca credentials` };
    }
    if (broker.mode !== 'live') {
      return { actionable: true, failure: `${symbol}: LIVE mode but broker keys are paper` };
    }
    try {
      await openLiveTrade({ clerkId, signalId: signalRowId, signal, risk, entrySnapshot, broker });
      return { actionable: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { actionable: true, failure: `${symbol}: ${msg}` };
    }
  }

  const user = await db.getBotContext(clerkId);
  const paperTradeCount = await countPaperTrades(clerkId);
  if (!user || !canUsePaperTrading(user.role, user.subscription, paperTradeCount, user.email)) {
    return { actionable: true, failure: `${symbol}: paper trading not permitted` };
  }
  const simOnly = mustUsePaperSimulator(user.role, user.subscription, user.email, user.founderPlanOverride ?? null);
  if (simOnly) {
    try {
      await openPaperTrade({ clerkId, signalId: signalRowId, signal, risk, entrySnapshot });
      return { actionable: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { actionable: true, failure: `${symbol}: ${msg}` };
    }
  }
  const broker = await loadUserBroker(clerkId, true);
  if (broker?.mode === 'paper') {
    try {
      await openBrokerTrade({
        clerkId,
        signalId: signalRowId,
        signal,
        risk,
        entrySnapshot,
        broker,
        mode: 'PAPER',
      });
      return { actionable: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Alpaca paper order failed for ${symbol}, falling back to simulator: ${msg}`);
      try {
        await openPaperTrade({ clerkId, signalId: signalRowId, signal, risk, entrySnapshot });
        return { actionable: true };
      } catch (fallbackErr) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return { actionable: true, failure: `${symbol}: Alpaca failed (${msg}); simulator failed (${fallbackMsg})` };
      }
    }
  }

  await openPaperTrade({ clerkId, signalId: signalRowId, signal, risk, entrySnapshot });
  return { actionable: true };
}

export async function runCycleForUser(
  clerkId: string,
  options?: { manualScan?: boolean },
): Promise<ScanCycleResult> {
  const empty: ScanCycleResult = {
    ok: false,
    symbolsScanned: 0,
    stockSymbols: 0,
    cryptoSymbols: 0,
    skippedMarketClosed: 0,
  };

  const ctx = await loadUserBotContext(clerkId, options);
  if (!ctx || (ctx.settings.mode !== 'PAPER' && ctx.settings.mode !== 'LIVE')) {
    return { ...empty, reason: 'bot_stopped' };
  }

  if (ctx.watchlist.length === 0) {
    return { ...empty, ok: true, reason: 'empty_watchlist' };
  }

  const marketOpen = await stockMarketOpenForUser(clerkId);

  const broker = await loadUserBroker(clerkId, ctx.settings.mode !== 'LIVE');
  let md;
  try {
    md = await getMarketDataForUser(clerkId);
  } catch (err) {
    console.error(`market data unavailable for user ${clerkId}`, err);
    return { ...empty, reason: 'market_data_unavailable' };
  }

  try {
    if (ctx.settings.mode === 'LIVE') {
      if (broker) await monitorUserBrokerTrades(clerkId, broker);
    } else if (broker?.mode === 'paper') {
      await monitorUserBrokerTrades(clerkId, broker);
    } else {
      await monitorUserOpenTrades(clerkId);
    }
  } catch (err) {
    console.error(`monitor failed for user ${clerkId}`, err);
  }

  const result: ScanCycleResult = {
    ...empty,
    ok: true,
    actionableEntries: 0,
    executionFailures: [],
    skippedRateLimit: 0,
  };

  const candleBudgetPerSymbol = Math.max(1, ctx.timeframes.length);

  for (const watched of ctx.watchlist) {
    const crypto = isCryptoSymbol(watched.symbol);
    if (crypto) {
      result.cryptoSymbols++;
    } else {
      result.stockSymbols++;
      if (!marketOpen) {
        result.skippedMarketClosed++;
        continue;
      }
    }
    result.symbolsScanned++;
    if (md?.tryAcquireBudget && !md.tryAcquireBudget(candleBudgetPerSymbol)) {
      result.skippedRateLimit = (result.skippedRateLimit ?? 0) + 1;
      continue;
    }
    try {
      const entry = await evaluateSymbolEntry(ctx, watched.symbol, watched.exchange, md);
      if (entry.actionable) result.actionableEntries = (result.actionableEntries ?? 0) + 1;
      if (entry.failure) result.executionFailures!.push(entry.failure);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`scan failed for ${watched.symbol} (user ${clerkId})`, err);
      result.executionFailures!.push(`${watched.symbol}: ${msg}`);
    }
  }

  // Refresh simulator equity with unrealized P&L (broker-backed users use Alpaca snapshots).
  if (ctx.settings.mode === 'PAPER' && broker?.mode !== 'paper') {
    try {
      await markToMarketUserFromQuotes(clerkId);
    } catch (err) {
      console.error(`mark-to-market failed for user ${clerkId}`, err);
    }
  }

  return { ...result, ok: true };
}

export async function runScanCycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const users = await db.getActiveBotUsers();
    for (const u of users) {
      try {
        await runCycleForUser(u.clerkId);
      } catch (err) {
        console.error(`scan cycle failed for user ${u.clerkId}`, err);
      }
    }
  } catch (err) {
    console.error('scan cycle error:', err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

export function startScanLoop(intervalMs = 60_000): void {
  if (timer) return;
  timer = setInterval(() => void runScanCycle(), intervalMs);
  console.log(`🟢 Scan loop started (polling every ${intervalMs / 1000}s)`);
}

export function stopScanLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
