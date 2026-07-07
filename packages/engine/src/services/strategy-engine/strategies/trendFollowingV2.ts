/**
 * 1. Trend-Following Strategy (new).
 * Trades in the direction of a clear, strong trend confirmed across timeframes.
 * Avoids choppy/ranging tape (that's mean-reversion's job).
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, atrPct, isDowntrend, isUptrend } from '../helpers';

export const TrendFollowingV2: Strategy = {
  internalName: 'trend_following_v2',
  displayName: 'Trend-Following Strategy',
  description:
    'Uses moving-average alignment, ADX trend strength, and MACD/structure confirmation to trade in directional markets. Stands down in choppy, sideways tape.',
  source: 'new',
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND'],
  avoidRegimes: ['RANGING', 'LOW_VOLATILITY', 'LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['EMA9/EMA21/SMA50/SMA200 alignment', 'ADX', 'MACD histogram', 'higher highs/lows'],
  requiredInputs: ['Multi-timeframe candles'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const bias = ctx.analysis[ctx.biasTf];
    const entry = ctx.analysis[ctx.entryTf];
    if (!bias || !entry) return abstain('No multi-timeframe data');

    const up = isUptrend(bias);
    const down = isDowntrend(bias);
    if (!up && !down) return abstain('No clear higher-timeframe trend');

    const side = up ? 'LONG' : 'SHORT';
    const e = entry.snapshot;
    const reasons: string[] = [];
    const doNotTrade: string[] = [];
    let score = 35;
    reasons.push(`Higher timeframe (${ctx.biasTf}) ${up ? 'uptrend' : 'downtrend'}: EMA stack aligned`);

    // Trend strength.
    const adx = bias.extra.adx;
    if (adx >= 30) { score += 25; reasons.push(`Strong trend (ADX ${adx.toFixed(0)})`); }
    else if (adx >= 18) { score += 12; reasons.push(`Moderate trend (ADX ${adx.toFixed(0)})`); }
    else { doNotTrade.push('Trend too weak (ADX < 18) — likely chop'); }

    // Long-term alignment via SMA200.
    if (up && e.price > e.sma200) { score += 10; reasons.push('Price above SMA200 (long-term up)'); }
    if (down && e.price < e.sma200) { score += 10; reasons.push('Price below SMA200 (long-term down)'); }

    // Momentum confirmation.
    const macdAligned = side === 'LONG' ? e.macd.histogram > 0 : e.macd.histogram < 0;
    if (macdAligned) { score += 15; reasons.push('MACD histogram confirms trend direction'); }

    // Don't chase an overextended move.
    if (side === 'LONG' && e.rsi14 > 80) doNotTrade.push('Overbought (RSI > 80) — risk of chasing');
    if (side === 'SHORT' && e.rsi14 < 20) doNotTrade.push('Oversold (RSI < 20) — risk of chasing');

    // Volatility sanity.
    if (atrPct(entry) < 0.3) doNotTrade.push('Volatility too low for a trend trade');

    return {
      applicable: true,
      side,
      score: Math.min(100, score),
      reasons,
      doNotTrade,
    };
  },
};
