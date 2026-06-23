/**
 * 8. Crypto News / Narrative (EXPERIMENTAL — needs a crypto news feed).
 * Trades verified crypto catalysts (listings, upgrades, ETF, hacks, unlocks)
 * ONLY when price + volume confirm. Refuses to trade exploit/hack chaos.
 * Abstains when no news data is present.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrExit, isUptrend, relVolume } from '../../helpers';

export const CryptoNews: Strategy = {
  internalName: 'crypto_news_narrative',
  displayName: 'Crypto News / Narrative',
  description:
    'Acts on verified crypto catalysts (listings, upgrades, ETF, partnerships, unlocks) only when price AND volume confirm the reaction. Long-only; refuses to trade into hack/exploit chaos. Abstains without a news feed.',
  source: 'experimental',
  assetType: 'crypto_spot',
  bestRegimes: ['CRYPTO_NEWS_DRIVEN', 'CRYPTO_HIGH_VOL_BREAKOUT', 'BTC_LED_UPTREND'],
  avoidRegimes: ['CRYPTO_LOW_LIQUIDITY', 'CRYPTO_LIQUIDATION_RISK', 'CRYPTO_CONFLICTING'],
  requiredInputs: ['Crypto news feed with sentiment + type'],
  indicators: ['news sentiment', 'event type', 'abnormal volume', 'price confirmation'],
  supports: { backtest: false, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const news = ctx.news;
    if (!news || news.items.length === 0) return abstain('No crypto news data available');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    // Never trade into exploit/hack chaos (defensive only).
    const recent = news.items.filter((n) => Date.now() - n.publishedAt < 8 * 3_600_000);
    if (recent.some((n) => n.type === 'lawsuit' || /hack|exploit/i.test(n.headline))) {
      return { applicable: true, side: null, score: 0, reasons: [], doNotTrade: ['Hack/exploit/legal chaos — no entries'], dataUsed: ['news'] };
    }

    const avg = recent.length ? recent.reduce((sum, n) => sum + n.sentiment, 0) / recent.length : 0;
    if (avg < 0.4) return abstain('Crypto news tone not strongly positive');

    // Confirmation gate: price + volume must agree.
    const priceUp = isUptrend(entry);
    const volUp = relVolume(entry) >= 1.3;
    if (!priceUp || !volUp) {
      return { applicable: true, side: null, score: 0, reasons: [], doNotTrade: ['Positive news but no price/volume confirmation — not trading on news alone'], dataUsed: ['news'] };
    }

    return {
      applicable: true,
      side: 'LONG',
      score: Math.min(72, 40 + recent.length * 6),
      reasons: [`Verified positive catalyst (${recent.length} headlines), price + volume confirm`],
      doNotTrade: [],
      ...atrExit(s.price, s.atr14, 'LONG', 2.5, 2.0),
      entrySignal: 'Verified bullish catalyst + price/volume confirmation',
      exitSignal: 'Move fades, volume dries up, or news is contradicted',
      dataUsed: ['news', 'candles', 'volume'],
    };
  },
};
