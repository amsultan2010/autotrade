/**
 * 6. News/Event-Driven Strategy (experimental).
 * Trades around fresh catalysts (earnings, analyst actions, filings, headlines)
 * but ONLY when sentiment and price action agree. Extra-cautious by design.
 *
 * Requires a NewsContext. With no news feed wired up yet, it abstains safely
 * rather than inventing a signal — so it's tagged `experimental`.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, block, isDowntrend, isUptrend } from '../helpers';

export const NewsEventStrategy: Strategy = {
  internalName: 'news_event_v1',
  displayName: 'News/Event-Driven Strategy',
  description:
    'Trades catalysts (earnings, analyst changes, filings, headlines) only when news sentiment AND price action agree. Reduces confidence or refuses to trade when they conflict, and avoids trading straight into an imminent earnings print.',
  source: 'experimental',
  bestRegimes: ['NEWS_EVENT', 'HIGH_VOLATILITY', 'BREAKOUT_SETUP'],
  avoidRegimes: ['LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['news sentiment', 'event type', 'abnormal volume', 'price-action confirmation'],
  requiredInputs: ['NewsContext (headlines + sentiment + earnings calendar)'],
  supports: { backtest: false, paper: true, live: true }, // backtesting needs historical news

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const news = ctx.news;
    if (!news || news.items.length === 0) return abstain('No news data available');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');

    // Don't trade into an imminent earnings print — gap risk is uncontrollable.
    if (news.earningsWithinHours != null && news.earningsWithinHours <= 4) {
      return block('Earnings within 4h — gap risk too high to enter');
    }

    // Aggregate recent sentiment (last 12h, recency-weighted lightly).
    const recent = news.items.filter((n) => Date.now() - n.publishedAt < 12 * 3_600_000);
    if (recent.length === 0) return abstain('No recent (<12h) headlines');
    const avgSentiment = recent.reduce((sum, n) => sum + n.sentiment, 0) / recent.length;
    if (Math.abs(avgSentiment) < 0.3) return abstain('News tone is mixed/neutral');

    const newsSide = avgSentiment > 0 ? 'LONG' : 'SHORT';
    if (ctx.isCrypto && newsSide === 'SHORT') return abstain('Crypto is long-only; negative-news short skipped');

    // Price action MUST confirm the news direction.
    const priceUp = isUptrend(entry);
    const priceDown = isDowntrend(entry);
    const confirms = (newsSide === 'LONG' && priceUp) || (newsSide === 'SHORT' && priceDown);
    if (!confirms) {
      return block(`News tone (${newsSide}) conflicts with price action — not trading on news alone`);
    }

    const reasons: string[] = [];
    const doNotTrade: string[] = [];
    let score = 35;
    reasons.push(`${recent.length} recent headlines, avg sentiment ${avgSentiment.toFixed(2)} (${newsSide})`);
    reasons.push('Price action confirms the news direction');

    if (news.abnormalVolume) { score += 18; reasons.push('Abnormal volume supports the catalyst'); }
    // Strong, fresh, single-source spikes are riskier than broad coverage.
    if (recent.length >= 3) { score += 12; reasons.push('Broad coverage (multiple headlines)'); }

    // Cap confidence: news moves are inherently less predictable.
    return { applicable: true, side: newsSide, score: Math.min(75, score), reasons, doNotTrade };
  },
};
