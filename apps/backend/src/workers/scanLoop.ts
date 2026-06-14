/**
 * Scan loop — the bot's polling heartbeat (fallback when streaming is off).
 * On each cycle, for every active user: monitor open trades, then evaluate each
 * watched symbol (analyze → decide → risk → paper execute).
 *
 * The per-user context loader and per-symbol evaluator are exported so the
 * real-time LiveEngine (Alpaca WebSocket) can reuse the exact same pipeline on
 * stream events — keeping one decision/risk/execution path (req #7).
 */
import type { BotSettings } from '@prisma/client';
import type { RiskLevel, StrategyId, Timeframe } from '@autotrade/shared';
import { prisma } from '../lib/prisma.js';
import { analyzeSymbol } from '../services/analysis/index.js';
import { decide } from '../services/decision/index.js';
import { evaluateRisk } from '../services/risk/index.js';
import { getStrategyWeights } from '../services/learning/index.js';
import {
  monitorUserOpenTrades,
  openPaperTrade,
  type EntrySnapshot,
} from '../services/execution/paper.engine.js';
import { isEntitled } from '../middleware/subscription.js';
import { isStockMarketOpen, isAlpacaConfigured } from '../lib/alpaca.js';
import { isCryptoSymbol } from '../services/marketdata/alpaca.provider.js';

let timer: NodeJS.Timeout | null = null;
let running = false;

// In-memory dedupe so we don't write a Signal row on every tick-driven scan.
// Persist only when the decision changes or after a cooldown.
const lastSignal = new Map<string, { action: string; ts: number }>();
const SIGNAL_DEDUP_MS = 60_000;

async function persistSignal(userId: string, signal: ReturnType<typeof decide>): Promise<string> {
  const row = await prisma.signal.create({
    data: {
      userId,
      ticker: signal.ticker,
      exchange: signal.exchange,
      price: signal.price,
      timeframe: signal.timeframe,
      strategy: signal.strategy,
      action: signal.action,
      confidence: signal.confidence,
      riskLevel: signal.riskLevel,
      entryReason: signal.entryReason,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      rrRatio: signal.rrRatio,
      explanation: signal.explanation,
    },
  });
  return row.id;
}

async function realizedPnlToday(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await prisma.trade.aggregate({
    where: { userId, closedAt: { gte: start }, result: { not: 'OPEN' } },
    _sum: { pnl: true },
  });
  return rows._sum.pnl ?? 0;
}

export interface UserBotContext {
  userId: string;
  settings: BotSettings;
  // Separate learned weights per asset class — crypto tunes independently.
  weights: { stock: Record<string, number>; crypto: Record<string, number> };
  equity: number;
  pnlToday: number;
  timeframes: Timeframe[];
  strategies: StrategyId[];
  watchlist: Array<{ symbol: string; exchange: string }>;
}

/**
 * Turn the user's risk level into real aggressiveness: HIGH lowers the
 * confidence bar and sizes up; LOW is conservative. Crypto gets a small extra
 * nudge because it's a more reactive market.
 */
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

/**
 * Load everything needed to run the bot for a user, or null if the user is not
 * eligible (disabled account, no active entitlement, or bot mode DISABLED).
 */
export async function loadUserBotContext(userId: string): Promise<UserBotContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      botSettings: true,
      paperAccount: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
      watchlist: { select: { symbol: true, exchange: true } },
    },
  });
  if (!user || user.status === 'DISABLED' || !user.botSettings) return null;
  if (user.botSettings.mode === 'DISABLED') return null;
  if (!isEntitled(user.role, user.subscription)) return null;

  return {
    userId,
    settings: user.botSettings,
    weights: {
      stock: await getStrategyWeights(userId, 'stock'),
      crypto: await getStrategyWeights(userId, 'crypto'),
    },
    equity: user.paperAccount?.equity ?? user.paperAccount?.balance ?? 0,
    pnlToday: await realizedPnlToday(userId),
    timeframes: user.botSettings.timeframes as Timeframe[],
    strategies: user.botSettings.strategies as StrategyId[],
    watchlist: user.watchlist,
  };
}

/**
 * Evaluate one symbol for one user: analyze → decide → record signal → risk →
 * open a paper trade if approved. Shared by the polling loop and the stream.
 */
export async function evaluateSymbolEntry(
  ctx: UserBotContext,
  symbol: string,
  exchange: string,
): Promise<void> {
  const { userId, settings } = ctx;

  // Don't open new STOCK positions when the US market is closed (prices are
  // stale). Crypto trades 24/7 and is never gated here.
  if (isAlpacaConfigured() && !isCryptoSymbol(symbol) && !(await isStockMarketOpen())) return;

  const openCount = await prisma.trade.count({
    where: { userId, mode: 'PAPER', result: 'OPEN' },
  });

  const analysis = await analyzeSymbol(symbol, ctx.timeframes);
  if (Object.keys(analysis).length === 0) return;

  // Use the asset-class learning track + risk-level aggressiveness.
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

  // (Crypto long-only handling now lives in the decision engine.)

  // Record decisions for the activity feed, deduped: only when the decision
  // changes or after a cooldown — otherwise tick-driven scanning spams rows.
  const isActionable = signal.action === 'BUY' || signal.action === 'SELL';
  const sigKey = `${userId}:${symbol}`;
  const prev = lastSignal.get(sigKey);
  const decisionChanged =
    !prev || prev.action !== signal.action || Date.now() - prev.ts > SIGNAL_DEDUP_MS;

  let signalRowId: string | null = null;
  if (decisionChanged) {
    signalRowId = await persistSignal(userId, signal);
    lastSignal.set(sigKey, { action: signal.action, ts: Date.now() });
    // Prune stale entries to prevent unbounded memory growth.
    const cutoff = Date.now() - SIGNAL_DEDUP_MS * 10;
    for (const [k, v] of lastSignal) {
      if (v.ts < cutoff) lastSignal.delete(k);
    }
  }

  if (!isActionable) return;

  // Avoid stacking multiple open trades on the same symbol.
  const alreadyOpen = await prisma.trade.findFirst({
    where: { userId, symbol, mode: 'PAPER', result: 'OPEN' },
    select: { id: true },
  });
  if (alreadyOpen) return;

  // Ensure there's a signal row to link the trade to (the feed entry may have
  // been deduped away above).
  if (!signalRowId) signalRowId = await persistSignal(userId, signal);

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

  await openPaperTrade({ userId, signalId: signalRowId, signal, risk, entrySnapshot });
}

export async function runCycleForUser(userId: string): Promise<void> {
  // Monitor open trades even if the bot won't open new ones this cycle.
  await monitorUserOpenTrades(userId);

  const ctx = await loadUserBotContext(userId);
  if (!ctx || ctx.settings.mode !== 'PAPER') return;

  for (const watched of ctx.watchlist) {
    await evaluateSymbolEntry(ctx, watched.symbol, watched.exchange);
  }
}

/** One full polling cycle across all eligible users. Never throws. */
export async function runScanCycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', botSettings: { mode: { not: 'DISABLED' } } },
      select: { id: true },
    });
    for (const u of users) {
      try {
        await runCycleForUser(u.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`scan cycle failed for user ${u.id}`, err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('scan cycle error:', err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

export function startScanLoop(intervalMs = 60_000): void {
  if (timer) return;
  timer = setInterval(() => void runScanCycle(), intervalMs);
  // eslint-disable-next-line no-console
  console.log(`🟢 Scan loop started (polling every ${intervalMs / 1000}s)`);
}

export function stopScanLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
