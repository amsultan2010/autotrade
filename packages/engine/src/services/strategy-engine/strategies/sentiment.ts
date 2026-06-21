/**
 * 7. Sentiment-Based Strategy (experimental).
 * Trades strong, persistent news/social sentiment — but NEVER on sentiment
 * alone. Price and volume must confirm.
 *
 * Reuses the NewsContext sentiment feed. Abstains when no sentiment data exists.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, block, relVolume } from '../helpers';

export const SentimentStrategy: Strategy = {
  internalName: 'sentiment_v1',
  displayName: 'Sentiment-Based Strategy',
  description:
    'Acts on strongly one-sided news/social sentiment, but only with technical confirmation (price direction + above-average volume). Never trades on sentiment alone.',
  source: 'experimental',
  bestRegimes: ['NEWS_EVENT', 'STRONG_UPTREND', 'STRONG_DOWNTREND', 'HIGH_VOLATILITY'],
  avoidRegimes: ['LOW_LIQUIDITY', 'RISK_OFF', 'RANGING', 'CONFLICTING'],
  indicators: ['aggregate sentiment', 'headline frequency', 'relative volume', 'price confirmation'],
  requiredInputs: ['NewsContext (or social sentiment feed)'],
  supports: { backtest: false, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const news = ctx.news;
    if (!news || news.items.length === 0) return abstain('No sentiment data available');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    // Require a strong, broad sentiment skew over the last day.
    const recent = news.items.filter((n) => Date.now() - n.publishedAt < 24 * 3_600_000);
    if (recent.length < 3) return abstain('Not enough headline volume for a sentiment read');
    const avg = recent.reduce((sum, n) => sum + n.sentiment, 0) / recent.length;
    if (Math.abs(avg) < 0.4) return abstain('Sentiment not strongly one-sided');

    const side = avg > 0 ? 'LONG' : 'SHORT';
    if (ctx.isCrypto && side === 'SHORT') return abstain('Crypto is long-only');

    // CONFIRMATION GATE — the core safety rule: never trade sentiment alone.
    const priceConfirms = side === 'LONG' ? s.price > s.ema21 : s.price < s.ema21;
    const volConfirms = relVolume(entry) >= 1.2;
    if (!priceConfirms || !volConfirms) {
      return block('Sentiment lacks price/volume confirmation — not trading on sentiment alone');
    }

    const reasons: string[] = [
      `Strong ${side === 'LONG' ? 'positive' : 'negative'} sentiment (avg ${avg.toFixed(2)}, ${recent.length} headlines)`,
      `Price ${side === 'LONG' ? 'above' : 'below'} EMA21 confirms`,
      'Above-average volume confirms participation',
    ];
    let score = 40;
    if (Math.abs(avg) >= 0.6) score += 12;
    if (news.abnormalVolume) score += 10;

    // Sentiment is soft data — keep a hard confidence ceiling.
    return { applicable: true, side, score: Math.min(70, score), reasons, doNotTrade: [] };
  },
};
