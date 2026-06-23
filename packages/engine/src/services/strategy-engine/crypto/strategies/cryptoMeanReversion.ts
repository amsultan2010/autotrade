/**
 * 3. Crypto Mean-Reversion — fade an oversold stretch back toward the mean.
 * Long-only (buy dips). Stands down in strong trends and news pumps/crashes.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrExit, nearLevel, priceZScore } from '../../helpers';

export const CryptoMeanReversion: Strategy = {
  internalName: 'crypto_mean_reversion',
  displayName: 'Crypto Mean-Reversion',
  description:
    'Buys oversold dips that have stretched too far below the mean (RSI + distance-from-EMA z-score + support), expecting a bounce toward VWAP/EMA. Avoids strong trends and news-driven moves. Spot long-only.',
  source: 'crypto_new',
  assetType: 'crypto_spot',
  bestRegimes: ['CRYPTO_RANGING'],
  avoidRegimes: ['BTC_LED_UPTREND', 'BTC_LED_DOWNTREND', 'CRYPTO_HIGH_VOL_BREAKOUT', 'CRYPTO_NEWS_DRIVEN', 'CRYPTO_LOW_LIQUIDITY', 'CRYPTO_LIQUIDATION_RISK'],
  requiredInputs: ['Entry-timeframe candles', 'session VWAP (optional)'],
  indicators: ['RSI oversold', 'distance-from-EMA z-score', 'VWAP distance', 'support', 'reversal candle'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;
    const z = priceZScore(entry);

    // Long-only: only fade oversold stretches.
    if (!(s.rsi14 <= 32 && z <= -1.0)) return abstain('Not oversold/stretched enough for a long revert');

    const reasons: string[] = [`Oversold (RSI ${s.rsi14.toFixed(0)}, ${z.toFixed(1)}σ below mean)`];
    const doNotTrade: string[] = [];
    let score = 44;

    if (entry.extra.adx > 32) doNotTrade.push('Strong trend (ADX > 32) — fading is dangerous');
    if (nearLevel(s.price, s.support, 1.5)) { score += 22; reasons.push('At/near support'); }
    if (ctx.vwap != null && s.price < ctx.vwap) { score += 8; reasons.push('Below VWAP — room to revert up'); }
    if (entry.extra.bullishEngulfing) { score += 16; reasons.push('Bullish reversal candle'); }
    else doNotTrade.push('No reversal confirmation yet');

    // Target the mean (EMA21 / VWAP), stop below the extreme.
    const exit = atrExit(s.price, s.atr14, 'LONG', 1.2, 1.8);
    return {
      applicable: true,
      side: 'LONG',
      score: Math.min(100, score),
      reasons,
      doNotTrade,
      ...exit,
      takeProfit: Math.max(exit.takeProfit, s.ema21), // aim at least back to the mean
      entrySignal: 'Oversold exhaustion + reversal confirmation',
      exitSignal: 'Reversion to VWAP/EMA, or stop below the low',
      dataUsed: ['candles', 'RSI', 'z-score', 'VWAP', 'support'],
    };
  },
};
