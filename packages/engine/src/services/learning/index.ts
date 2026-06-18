/**
 * LearningService — the honest, statistical personalization layer (req #10, #12).
 * After each closed trade it updates per-user, per-strategy realized stats and
 * nudges a bounded confidence multiplier toward what actually works for THAT
 * user's symbols. No market prediction, no shared one-size-fits-all behavior.
 */
import { prisma } from '../../lib/prisma';

const WEIGHT_MIN = 0.5;
const WEIGHT_MAX = 1.5;
/** Trades needed before the weight can swing to its full range (anti-overfit). */
const FULL_CONFIDENCE_TRADES = 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Recompute one StrategyStat row from its running totals. */
function deriveWeight(trades: number, wins: number): number {
  if (trades === 0) return 1.0;
  const winRate = wins / trades;
  const blend = Math.min(trades, FULL_CONFIDENCE_TRADES) / FULL_CONFIDENCE_TRADES;
  // Centered on 0.5 win-rate → multiplier 1.0; smoothed by sample size.
  return clamp(1 + blend * (winRate - 0.5), WEIGHT_MIN, WEIGHT_MAX);
}

/** Aggregate-row sentinel: "" means "across all symbols". */
const AGGREGATE = '';

async function bump(
  userId: string,
  strategy: string,
  symbol: string,
  pnl: number,
  win: boolean,
): Promise<void> {
  const existing = await prisma.strategyStat.findUnique({
    where: { userId_strategy_symbol: { userId, strategy, symbol } },
  });

  const trades = (existing?.trades ?? 0) + 1;
  const wins = (existing?.wins ?? 0) + (win ? 1 : 0);
  const losses = (existing?.losses ?? 0) + (win ? 0 : 1);
  const totalPnl = (existing?.totalPnl ?? 0) + pnl;
  const expectancy = totalPnl / trades;
  const weightedConfidence = deriveWeight(trades, wins);

  await prisma.strategyStat.upsert({
    where: { userId_strategy_symbol: { userId, strategy, symbol } },
    update: { trades, wins, losses, totalPnl, expectancy, weightedConfidence },
    create: {
      userId,
      strategy,
      symbol,
      trades,
      wins,
      losses,
      totalPnl,
      expectancy,
      weightedConfidence,
    },
  });
}

// Asset-class aggregate sentinels — crypto learns separately from stocks so
// each tunes its own per-strategy confidence (req #10, user-requested split).
const STOCK_AGG = '__STOCK__';
const CRYPTO_AGG = '__CRYPTO__';
export type AssetClass = 'stock' | 'crypto';
function classOf(symbol: string): AssetClass {
  return symbol.includes('/') ? 'crypto' : 'stock';
}
function classAggKey(symbol: string): string {
  return classOf(symbol) === 'crypto' ? CRYPTO_AGG : STOCK_AGG;
}

/** Call once per closed trade. Updates per-symbol, overall, and asset-class rows. */
export async function recordOutcome(params: {
  userId: string;
  strategy: string;
  symbol: string;
  pnl: number;
  win: boolean;
}): Promise<void> {
  const { userId, strategy, symbol, pnl, win } = params;
  await bump(userId, strategy, symbol, pnl, win); // per-symbol
  await bump(userId, strategy, AGGREGATE, pnl, win); // overall (all symbols)
  await bump(userId, strategy, classAggKey(symbol), pnl, win); // crypto vs stock
}

/**
 * Learned weights for a user, scoped to an asset class: strategy → multiplier
 * (default 1.0). Crypto and stock tracks evolve independently.
 */
export async function getStrategyWeights(
  userId: string,
  assetClass: AssetClass,
): Promise<Record<string, number>> {
  const key = assetClass === 'crypto' ? CRYPTO_AGG : STOCK_AGG;
  const rows = await prisma.strategyStat.findMany({
    where: { userId, symbol: key },
    select: { strategy: true, weightedConfidence: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.strategy] = r.weightedConfidence;
  return out;
}
