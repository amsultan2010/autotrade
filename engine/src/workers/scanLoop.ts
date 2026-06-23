/**
 * Scan loop — the bot's polling heartbeat (fallback when streaming is off).
 */
import type { BotSettingsRecord } from '../types/db';
import type { RiskLevel, StrategyId, Timeframe } from '@autotrade/shared';
import * as db from '../lib/convex-db';
import { analyzeSymbol } from '../services/analysis/index';
import { decide } from '../services/decision/index';
import { evaluateRisk } from '../services/risk/index';
import { getStrategyWeights } from '../services/learning/index';
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

async function persistSignal(clerkId: string, signal: ReturnType<typeof decide>): Promise<string> {
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

export interface UserBotContext {
  clerkId: string;
  settings: BotSettingsRecord;
  weights: { stock: Record<string, number>; crypto: Record<string, number> };
  equity: number;
  pnlToday: number;
  timeframes: Timeframe[];
  strategies: StrategyId[];
  watchlist: Array<{ symbol: string; exchange: string }>;
}

function aggressiveness(
  riskLevel: RiskLevel,
  isCrypto: boolean,
): { thresholdDelta: number; sizeMult: number } {
  const base =
    riskLevel === 'HIGH'
      ? { thresholdDelta: -15, sizeMult: 1.5 }
      : riskLevel === 'LOW'
        ? { thresholdDelta: 10, sizeMult: 0.6 }
        : { thresholdDelta: 0, sizeMult: 1.0 };
  if (isCrypto) base.thresholdDelta -= 5;
  return base;
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
  if (!isLiveMode) {
    const broker = await loadUserBroker(clerkId);
    if (broker?.mode === 'paper') {
      try {
        const account = await broker.getAccount();
        equity = account.equity ?? account.buyingPower ?? equity;
      } catch {
        /* keep internal paper equity */
      }
    }
  }

  return {
    clerkId,
    settings: user.botSettings,
    weights: {
      stock: await getStrategyWeights(clerkId, 'stock'),
      crypto: await getStrategyWeights(clerkId, 'crypto'),
    },
    equity,
    pnlToday: await db.realizedPnlToday(clerkId),
    timeframes: user.botSettings.timeframes as Timeframe[],
    strategies: user.botSettings.strategies as StrategyId[],
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
  const weights = crypto ? ctx.weights.crypto : ctx.weights.stock;
  const { thresholdDelta, sizeMult } = aggressiveness(settings.riskLevel as RiskLevel, crypto);
  const effMinConfidence = Math.max(0, Math.min(100, settings.minConfidence + thresholdDelta));
  const effRiskPerTradePct = settings.riskPerTradePct * sizeMult;

  const signal = decide({
    symbol,
    exchange,
    analysis,
    timeframes: ctx.timeframes,
    enabledStrategies: ctx.strategies,
    minConfidence: effMinConfidence,
    defaultStopPct: settings.defaultStopPct,
    defaultTakeProfitPct: settings.defaultTakeProfitPct,
    learningWeights: weights,
  });

  const isActionable = signal.action === 'BUY' || signal.action === 'SELL';
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

  if (!isActionable) return;

  const alreadyOpen = await db.findOpenTradeBySymbol(clerkId, symbol, tradeMode);
  if (alreadyOpen) return;

  if (!signalRowId) signalRowId = await persistSignal(clerkId, signal);

  const risk = evaluateRisk(
    signal,
    {
      mode: settings.mode,
      maxActiveTrades: settings.maxActiveTrades,
      maxTradeSize: settings.maxTradeSize,
      riskPerTradePct: effRiskPerTradePct,
      maxDailyLoss: settings.maxDailyLoss,
      tradingHoursStart: settings.tradingHoursStart,
      tradingHoursEnd: settings.tradingHoursEnd,
    },
    { equity: ctx.equity, openTradeCount: openCount, realizedPnlToday: ctx.pnlToday },
  );
  if (!risk.approved) return;

  const snap = analysis[signal.timeframe]?.snapshot;
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
