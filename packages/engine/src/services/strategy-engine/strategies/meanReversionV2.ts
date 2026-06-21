/**
 * 3. Mean-Reversion Strategy (new).
 * Fades price that has stretched too far from its recent average, expecting a
 * snap back. Stands down during strong trends, breakouts, and news shocks.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, nearLevel, priceZScore } from '../helpers';

export const MeanReversionV2: Strategy = {
  internalName: 'mean_reversion_v2',
  displayName: 'Mean-Reversion Strategy',
  description:
    'Fades over-extended moves back toward the mean using RSI extremes, distance-from-EMA z-score, and structure. Explicitly avoids strong trends, breakouts, and news-driven moves.',
  source: 'new',
  bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
  avoidRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND', 'BREAKOUT_SETUP', 'NEWS_EVENT', 'HIGH_VOLATILITY', 'LOW_LIQUIDITY', 'RISK_OFF'],
  indicators: ['RSI overbought/oversold', 'distance-from-EMA z-score', 'support/resistance', 'reversal candle'],
  requiredInputs: ['Entry-timeframe candles'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;
    const z = priceZScore(entry); // + = stretched above mean, - = below
    const reasons: string[] = [];
    const doNotTrade: string[] = [];

    // Strong trend is mean-reversion's enemy.
    if (entry.extra.adx > 30) doNotTrade.push('Strong trend (ADX > 30) — fading is dangerous');

    // Oversold → expect bounce (LONG).
    if (s.rsi14 <= 30 && z <= -1.0) {
      let score = 45;
      reasons.push(`Oversold (RSI ${s.rsi14.toFixed(0)}, ${z.toFixed(1)}σ below mean)`);
      if (nearLevel(s.price, s.support, 1)) { score += 22; reasons.push('At/near support'); }
      if (entry.extra.bullishEngulfing) { score += 15; reasons.push('Bullish reversal candle'); }
      return { applicable: true, side: 'LONG', score: Math.min(100, score), reasons, doNotTrade };
    }

    // Overbought → expect fade (SHORT). Crypto is long-only.
    if (s.rsi14 >= 70 && z >= 1.0 && !ctx.isCrypto) {
      let score = 45;
      reasons.push(`Overbought (RSI ${s.rsi14.toFixed(0)}, ${z.toFixed(1)}σ above mean)`);
      if (nearLevel(s.price, s.resistance, 1)) { score += 22; reasons.push('At/near resistance'); }
      if (entry.extra.bearishEngulfing) { score += 15; reasons.push('Bearish reversal candle'); }
      return { applicable: true, side: 'SHORT', score: Math.min(100, score), reasons, doNotTrade };
    }

    return abstain('Price not stretched far enough from the mean');
  },
};
