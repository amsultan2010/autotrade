/**
 * 5. Funding Rate / Perpetual Sentiment (EXPERIMENTAL — needs perp/funding data).
 * Funding is a FILTER, not a standalone signal. Crowded longs (very positive
 * funding) = caution; crowded shorts (very negative funding) = possible squeeze.
 * asset_type = crypto_perp, so the crypto risk manager BLOCKS it unless the user
 * explicitly enables leverage/high-risk mode. Abstains when funding data is absent.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain } from '../../helpers';

export const FundingRatePerp: Strategy = {
  internalName: 'crypto_funding_perp',
  displayName: 'Funding Rate / Perp Sentiment',
  description:
    'Reads perpetual funding + open interest as a sentiment FILTER (never a standalone signal). Flags crowded longs/shorts and possible squeezes. Perp/leverage strategy — disabled by default; requires high-risk mode.',
  source: 'experimental',
  assetType: 'crypto_perp',
  bestRegimes: ['CRYPTO_LEVERAGE_HEAVY', 'CRYPTO_HIGH_VOL_BREAKOUT', 'BTC_LED_UPTREND'],
  avoidRegimes: ['CRYPTO_LOW_LIQUIDITY', 'CRYPTO_CONFLICTING'],
  requiredInputs: ['Funding rate', 'open interest', 'long/short ratio (perp/futures venue)'],
  indicators: ['funding rate', 'funding change', 'open interest', 'long/short ratio', 'perp basis'],
  supports: { backtest: false, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const f = ctx.crypto?.funding;
    if (!f || f.fundingRate == null) return abstain('No funding/perp data available');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    const reasons: string[] = [];
    const doNotTrade: string[] = [];

    // Crowded longs → do not add longs into them.
    if (f.fundingRate >= 0.0008) {
      return { applicable: true, side: null, score: 0, reasons: [`Funding very positive (${(f.fundingRate * 100).toFixed(3)}%) — crowded longs`], doNotTrade: ['Crowded longs — avoid chasing'], dataUsed: ['funding'] };
    }

    // Crowded shorts + price holding → possible squeeze up (cautious long).
    const holding = s.price >= s.ema21;
    if (f.fundingRate <= -0.0005 && holding) {
      reasons.push(`Funding negative (${(f.fundingRate * 100).toFixed(3)}%) — crowded shorts, squeeze risk up`);
      let score = 42;
      if (f.openInterestChangePct != null && f.openInterestChangePct < 0) { score += 8; reasons.push('OI falling — short covering'); }
      return {
        applicable: true,
        side: 'LONG',
        score: Math.min(70, score),
        reasons,
        doNotTrade,
        entrySignal: 'Negative-funding squeeze setup, price holding the mean',
        exitSignal: 'Funding normalizes or price loses the mean',
        dataUsed: ['funding', 'open interest', 'EMA'],
      };
    }

    return abstain('Funding not at a tradeable extreme');
  },
};
