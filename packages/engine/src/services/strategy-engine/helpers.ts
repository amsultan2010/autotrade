/**
 * Shared, pure read-helpers over the existing analysis snapshot. These wrap the
 * real `IndicatorSnapshot` + `ExtraReads` shapes (see services/analysis) so the
 * strategy modules and the regime detector read indicators consistently.
 */
import type { TimeframeAnalysis } from '../analysis/index';
import type { StrategyEvaluation } from './types';

export type TrendDir = 'UP' | 'DOWN' | 'FLAT';

/** Standard "this strategy has nothing to say / can't act" result. */
export function abstain(reason?: string): StrategyEvaluation {
  return { applicable: false, side: null, score: 0, reasons: reason ? [reason] : [], doNotTrade: [] };
}

/** Standard "do not trade" result — the strategy applied but flags danger. */
export function block(reason: string): StrategyEvaluation {
  return { applicable: true, side: null, score: 0, reasons: [], doNotTrade: [reason] };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** ATR as a percentage of price — the engine's primary volatility read. */
export function atrPct(a: TimeframeAnalysis): number {
  const s = a.snapshot;
  return s.price > 0 ? (s.atr14 / s.price) * 100 : 0;
}

export function isUptrend(a: TimeframeAnalysis): boolean {
  const s = a.snapshot;
  return s.ema9 > s.ema21 && s.ema21 > s.sma50;
}

export function isDowntrend(a: TimeframeAnalysis): boolean {
  const s = a.snapshot;
  return s.ema9 < s.ema21 && s.ema21 < s.sma50;
}

/** Coarse trend label combining EMA alignment with ADX strength. */
export function trendDirection(a: TimeframeAnalysis): TrendDir {
  if (isUptrend(a)) return 'UP';
  if (isDowntrend(a)) return 'DOWN';
  return 'FLAT';
}

/** True when `price` is within `tolPct` percent of `level`. */
export function nearLevel(price: number, level: number | null, tolPct: number): boolean {
  if (level == null || price <= 0) return false;
  return Math.abs(price - level) / price <= tolPct / 100;
}

/**
 * Rough z-score of price vs the EMA21 "mean", scaled by ATR. We don't store a
 * rolling stddev, so ATR is a reasonable, available proxy for dispersion. This
 * is intentionally approximate — used only for "how stretched is price" reads.
 */
export function priceZScore(a: TimeframeAnalysis): number {
  const s = a.snapshot;
  if (s.atr14 <= 0) return 0;
  return (s.price - s.ema21) / s.atr14;
}

/** Relative volume vs the snapshot's own average (1.0 = normal). */
export function relVolume(a: TimeframeAnalysis): number {
  const s = a.snapshot;
  return s.avgVolume > 0 ? s.volume / s.avgVolume : 1;
}
