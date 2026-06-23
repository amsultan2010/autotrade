/**
 * 8. Statistical Arbitrage / Pairs Strategy (experimental).
 * Trades the mean-reversion of the spread between two historically related,
 * liquid assets when that spread stretches to an extreme z-score.
 *
 * Requires a PairContext (partner, correlation, spread z-score). Abstains when
 * the caller hasn't supplied one or when the relationship/liquidity is too weak.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, block } from '../helpers';

export const StatArbPairs: Strategy = {
  internalName: 'stat_arb_pairs_v1',
  displayName: 'Statistical Arbitrage / Pairs Strategy',
  description:
    'Trades the spread between two correlated/cointegrated, liquid assets when it diverges to an extreme z-score, expecting reversion. Requires sufficient history and liquid legs on both sides.',
  source: 'experimental',
  bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
  avoidRegimes: ['HIGH_VOLATILITY', 'NEWS_EVENT', 'RISK_OFF', 'LOW_LIQUIDITY', 'STRONG_UPTREND', 'STRONG_DOWNTREND'],
  indicators: ['pair correlation', 'cointegration (optional)', 'spread z-score', 'beta'],
  requiredInputs: ['PairContext (partner symbol, correlation, spread z-score, liquidity)'],
  supports: { backtest: true, paper: true, live: false }, // live pairs needs simultaneous two-leg execution

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const pair = ctx.pair;
    if (!pair) return abstain('No pair/partner data available');
    if (ctx.isCrypto) return abstain('Pairs strategy is configured for equities here');

    // Relationship + liquidity must be strong enough to lean on.
    if (Math.abs(pair.correlation) < 0.7) return abstain(`Correlation too weak (${pair.correlation.toFixed(2)})`);
    if (!pair.partnerLiquid) return block('Partner leg is illiquid — pair trade unsafe');
    if (pair.cointegrated === false) return abstain('Pair failed cointegration test');

    const z = pair.spreadZScore;
    if (Math.abs(z) < 2) return abstain(`Spread not stretched enough (z ${z.toFixed(2)})`);

    // Spread high (z > 0) → this leg rich vs partner → SHORT this leg (revert down).
    // Spread low  (z < 0) → this leg cheap vs partner → LONG this leg (revert up).
    const side = z > 0 ? 'SHORT' : 'LONG';
    const reasons: string[] = [
      `Spread vs ${pair.partnerSymbol} at ${z.toFixed(2)}σ (correlation ${pair.correlation.toFixed(2)})`,
      pair.cointegrated ? 'Pair is cointegrated' : 'Correlated pair (no cointegration test supplied)',
      `Expecting reversion → ${side} this leg`,
    ];
    let score = 45 + Math.min(25, (Math.abs(z) - 2) * 12); // more stretch → more score
    if (pair.cointegrated) score += 10;

    return { applicable: true, side, score: Math.min(85, score), reasons, doNotTrade: [] };
  },
};
