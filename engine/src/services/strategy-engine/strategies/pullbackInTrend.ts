/**
 * 5. Pullback-in-Trend Strategy (new).
 * Enters on a temporary pullback within an intact trend, expecting continuation.
 * Only valid while the larger trend holds.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, isDowntrend, isUptrend, nearLevel } from '../helpers';

export const PullbackInTrend: Strategy = {
  internalName: 'pullback_in_trend_v1',
  displayName: 'Pullback-in-Trend Strategy',
  description:
    'Buys dips (or sells rallies) into a trend at the EMA/VWAP with an RSI reset and a reversal candle, only while the higher-timeframe trend is intact.',
  source: 'new',
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND'],
  avoidRegimes: ['RANGING', 'HIGH_VOLATILITY', 'NEWS_EVENT', 'LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['EMA21/VWAP pullback', 'RSI reset', 'reversal candle', 'higher-timeframe trend filter'],
  requiredInputs: ['Multi-timeframe candles'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const bias = ctx.analysis[ctx.biasTf];
    const entry = ctx.analysis[ctx.entryTf];
    if (!bias || !entry) return abstain('No multi-timeframe data');

    const up = isUptrend(bias);
    const down = isDowntrend(bias);
    if (!up && !down) return abstain('No intact higher-timeframe trend to pull back within');
    if (ctx.isCrypto && down) return abstain('Crypto is long-only; downtrend pullback skipped');

    const side = up ? 'LONG' : 'SHORT';
    const s = entry.snapshot;
    const reasons: string[] = [];
    const doNotTrade: string[] = [];
    let score = 25;
    reasons.push(`Trend intact on ${ctx.biasTf}; seeking a ${up ? 'dip' : 'rally'} entry`);

    // Pullback to dynamic support/resistance: EMA21 or session VWAP.
    const atEma = nearLevel(s.price, s.ema21, 1);
    const atVwap = ctx.vwap != null && nearLevel(s.price, ctx.vwap, 1);
    if (atEma) { score += 22; reasons.push('Pulled back to EMA21'); }
    if (atVwap) { score += 12; reasons.push('Pulled back to session VWAP'); }
    if (!atEma && !atVwap) return abstain('Price not at a pullback zone (EMA21/VWAP)');

    // RSI should have reset toward neutral (not still extended).
    if (up && s.rsi14 >= 40 && s.rsi14 <= 55) { score += 18; reasons.push(`RSI reset to neutral (${s.rsi14.toFixed(0)})`); }
    if (down && s.rsi14 >= 45 && s.rsi14 <= 60) { score += 18; reasons.push(`RSI reset to neutral (${s.rsi14.toFixed(0)})`); }

    // Reversal candle = trend resuming.
    if (up && entry.extra.bullishEngulfing) { score += 18; reasons.push('Bullish engulfing at the pullback'); }
    if (down && entry.extra.bearishEngulfing) { score += 18; reasons.push('Bearish engulfing at the pullback'); }

    // Guard: if the pullback has broken the trend's structure, stand down.
    if (up && s.price < s.sma50) doNotTrade.push('Pullback broke below SMA50 — trend may be failing');
    if (down && s.price > s.sma50) doNotTrade.push('Rally broke above SMA50 — trend may be failing');

    return { applicable: true, side, score: Math.min(100, score), reasons, doNotTrade };
  },
};
