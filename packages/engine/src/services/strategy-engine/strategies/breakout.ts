/**
 * 4. Breakout Strategy (new).
 * Trades a decisive break of support/resistance on strong volume, ideally after
 * a volatility squeeze. Requires confirmation to avoid false breakouts.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, atrPct, relVolume } from '../helpers';

export const BreakoutStrategy: Strategy = {
  internalName: 'breakout_v1',
  displayName: 'Breakout Strategy',
  description:
    'Trades breaks above resistance / below support confirmed by a volume surge and (ideally) prior volatility compression. Requires confirmation and rejects unconfirmed/false breakouts.',
  source: 'new',
  bestRegimes: ['BREAKOUT_SETUP', 'STRONG_UPTREND', 'STRONG_DOWNTREND', 'HIGH_VOLATILITY'],
  avoidRegimes: ['RANGING', 'LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['support/resistance & prior highs/lows', 'volume confirmation', 'ATR compression', 'candle close'],
  requiredInputs: ['Entry-timeframe candles'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;
    const reasons: string[] = [];
    const doNotTrade: string[] = [];

    const rv = relVolume(entry);
    const brokeUp = s.resistance != null && s.price >= s.resistance;
    const brokeDown = s.support != null && s.price <= s.support;
    if (!brokeUp && !brokeDown) return abstain('No level break on the entry timeframe');
    if (ctx.isCrypto && brokeDown) return abstain('Crypto is long-only; downside break skipped');

    const side = brokeUp ? 'LONG' : 'SHORT';
    let score = 30;
    reasons.push(brokeUp ? 'Price broke prior resistance' : 'Price broke prior support');

    // False-breakout guard: a breakout without volume is suspect.
    if (rv >= 1.5) { score += 30; reasons.push(`Volume surge confirms the break (${rv.toFixed(1)}×)`); }
    else if (rv >= 1.2) { score += 15; reasons.push(`Above-average volume (${rv.toFixed(1)}×)`); }
    else { doNotTrade.push('Breakout lacks volume confirmation — likely false'); }

    // Squeeze-then-expand is the highest-quality breakout.
    const vol = atrPct(entry);
    if (vol >= 1.0) { score += 12; reasons.push('Volatility expanding through the level'); }

    // Momentum should agree with the break.
    const macdAligned = side === 'LONG' ? s.macd.histogram > 0 : s.macd.histogram < 0;
    if (macdAligned) { score += 10; reasons.push('MACD agrees with the break'); }

    // Require the break to be meaningful, not a 1-tick poke.
    const level = side === 'LONG' ? s.resistance! : s.support!;
    const throughPct = Math.abs(s.price - level) / s.price * 100;
    if (throughPct < 0.05) doNotTrade.push('Break is marginal (< 0.05%) — wait for a clean close');

    return { applicable: true, side, score: Math.min(100, score), reasons, doNotTrade };
  },
};
