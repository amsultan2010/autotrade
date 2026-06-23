/**
 * Scan loop — the bot's polling heartbeat (fallback when streaming is off).
 */
import type { BotSettingsRecord } from '../types/db';
import type { RiskLevel, Timeframe, TradeAction, TradeSignal } from '@autotrade/shared';
import { resolveStrategyLists } from '@autotrade/shared';
import * as db from '../lib/convex-db';
import { analyzeSymbol } from '../services/analysis/index';
import type { RiskDecision } from '../services/risk/index';
import { runStrategyEngine } from '../services/strategy-engine';
import type { StrategyDecision } from '../services/strategy-engine/types';
import {
  monitorUserOpenTrades,
  monitorUserBrokerTrades,
  openPaperTrade,
  openBrokerTrade,
  openLiveTrade,
  type EntrySnapshot,
} from '../services/execution/paper.engine';
import { loadUserBroker } from '../lib/broker-credentials';
import {
  canUsePaperTrading,
  countPaperTrades,
  isProEntitled,
} from '../middleware/subscription';
import { isStockMarketOpen, isAlpacaConfigured } from '../lib/alpaca';
import { isCryptoSymbol } from '../services/marketdata/alpaca.provider';

let timer: NodeJS.Timeout | null = null;
let running = false;

const lastSignal = new Map<string, { action: string; ts: number }>();
const SIGNAL_DEDUP_MS = 60_000;

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

export async function loadUserBotContext(clerkId: string): Promise<UserBotContext | null> {
  const user = await db.getBotContext(clerkId);
  if (!user || user.status === 'DISABLED' || !user.botSettings) return null;
  if (user.botSettings.mode === 'DISABLED') return null;

  const isLiveMode = user.botSettings.mode === 'LIVE';
  if (isLiveMode && !user.liveEntitled) return null;

  if (!isLiveMode) {
    const [paperTradeCount, openPaperTrades] = await Promise.all([
      countPaperTrades(clerkId),
      db.countOpenTrades(clerkId, 'PAPER'),
    ]);
    const canPaper =
      canUsePaperTrading(user.role, user.subscription, paperTradeCount) || openPaperTrades > 0;
    if (!canPaper) return null;
  }

  let equity = user.paperAccount?.equity ?? user.paperAccount?.balance ?? 0;
  const broker = await loadUserBroker(clerkId);
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
    settings: user.botSettings,
    ...resolveStrategyLists(user.botSettings),
    includeExperimental: user.botSettings.includeExperimental ?? false,
    equity,
    pnlToday: await db.realizedPnlToday(clerkId),
    timeframes: user.botSettings.timeframes as Timeframe[],
    watchlist: user.watchlist.map(({ symbol, exchange }) => ({ symbol, exchange })),
  };
}

export async function evaluateSymbolEntry(
  ctx: UserBotContext,
  symbol: string,
  exchange: string,
): Promise<void> {
  const { clerkId, settings } = ctx;
  const isLive = settings.mode === 'LIVE';

  if (isAlpacaConfigured() && !isCryptoSymbol(symbol) && !(await isStockMarketOpen())) return;

  const tradeMode = isLive ? 'LIVE' : 'PAPER';
  const openCount = await db.countOpenTrades(clerkId, tradeMode);

  const analysis = await analyzeSymbol(symbol, ctx.timeframes);
  if (Object.keys(analysis).length === 0) return;

  const crypto = isCryptoSymbol(symbol);
  const enabled = crypto ? ctx.cryptoStrategies : ctx.stockStrategies;

  const { decision, context: stratCtx } = runStrategyEngine({
    symbol,
    exchange,
    analysis,
    config: {
      mode: 'balanced',
      minConfidence: settings.minConfidence,
      enabledStrategies: enabled.length > 0 ? enabled : 'all',
      includeExperimental: ctx.includeExperimental,
    },
    account: {
      equity: ctx.equity,
      openTradeCount: openCount,
      realizedPnlToday: ctx.pnlToday,
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

  if (!isActionable || !decision.riskPlan || decision.blocked || !decision.side) return;

  const alreadyOpen = await db.findOpenTradeBySymbol(clerkId, symbol, tradeMode);
  if (alreadyOpen) return;

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

  if (isLive) {
    const broker = await loadUserBroker(clerkId);
    if (!broker) {
      console.warn(`LIVE mode for user ${clerkId} but no broker credentials — skipping`);
      return;
    }
    if (broker.mode !== 'live') {
      console.warn(`LIVE mode for user ${clerkId} but broker credentials are paper — skipping`);
      return;
    }
    await openLiveTrade({ clerkId, signalId: signalRowId, signal, risk, entrySnapshot, broker });
  } else {
    const user = await db.getBotContext(clerkId);
    const paperTradeCount = await countPaperTrades(clerkId);
    if (!user || !canUsePaperTrading(user.role, user.subscription, paperTradeCount)) return;
    const broker = await loadUserBroker(clerkId);
    if (broker?.mode === 'paper') {
      await openBrokerTrade({
        clerkId,
        signalId: signalRowId,
        signal,
        risk,
        entrySnapshot,
        broker,
        mode: 'PAPER',
      });
    } else {
      await openPaperTrade({ clerkId, signalId: signalRowId, signal, risk, entrySnapshot });
    }
  }
}

export async function runCycleForUser(clerkId: string): Promise<void> {
  const ctx = await loadUserBotContext(clerkId);
  if (!ctx || (ctx.settings.mode !== 'PAPER' && ctx.settings.mode !== 'LIVE')) return;

  const broker = await loadUserBroker(clerkId);
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

  for (const watched of ctx.watchlist) {
    try {
      await evaluateSymbolEntry(ctx, watched.symbol, watched.exchange);
    } catch (err) {
      console.error(`scan failed for ${watched.symbol} (user ${clerkId})`, err);
    }
  }
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
