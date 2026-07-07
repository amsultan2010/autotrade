/**
 * LearningService — the honest, statistical personalization layer (req #10, #12).
 * After each closed trade it updates per-user, per-strategy realized stats and
 * nudges a bounded confidence multiplier toward what actually works for THAT
 * user's symbols. No market prediction, no shared one-size-fits-all behavior.
 */
import * as db from '../../lib/supabase-db';

/** Aggregate-row sentinel: "" means "across all symbols". */
const AGGREGATE = '';

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
  clerkId: string;
  strategy: string;
  symbol: string;
  pnl: number;
  win: boolean;
}): Promise<void> {
  const { clerkId, strategy, symbol, pnl, win } = params;
  const base = { clerkId, strategy, won: win, pnl };
  await db.recordStrategyOutcome({ ...base, symbol });
  await db.recordStrategyOutcome({ ...base, symbol: AGGREGATE });
  await db.recordStrategyOutcome({ ...base, symbol: classAggKey(symbol) });
}

/**
 * Learned weights for a user, scoped to an asset class: strategy → multiplier
 * (default 1.0). Crypto and stock tracks evolve independently.
 */
export async function getStrategyWeights(
  clerkId: string,
  assetClass: AssetClass,
): Promise<Record<string, number>> {
  return db.getStrategyWeights(clerkId, assetClass);
}
