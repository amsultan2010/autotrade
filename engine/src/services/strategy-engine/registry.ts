/**
 * Strategy registry — the single place strategies are wired in.
 *
 * To add a new strategy: create strategies/yourStrategy.ts exporting a Strategy,
 * import it here, and add it to NEW_STRATEGIES. Nothing else needs to change —
 * the selector, config, logging, and backtester pick it up automatically.
 */
import type { ResolvedStrategyConfig } from './config';
import type { Strategy } from './types';

// Legacy (original logic, preserved & delegated — never modified).
import { LEGACY_STRATEGIES } from './strategies/legacy';

// New + experimental strategies (one file each).
import { TrendFollowingV2 } from './strategies/trendFollowingV2';
import { MomentumV2 } from './strategies/momentumV2';
import { MeanReversionV2 } from './strategies/meanReversionV2';
import { BreakoutStrategy } from './strategies/breakout';
import { PullbackInTrend } from './strategies/pullbackInTrend';
import { NewsEventStrategy } from './strategies/newsEvent';
import { SentimentStrategy } from './strategies/sentiment';
import { StatArbPairs } from './strategies/statArbPairs';
import { VwapIntraday } from './strategies/vwapIntraday';
import { MarketRegimeOverlay } from './strategies/marketRegimeOverlay';

// Crypto strategy set (self-gates to crypto assets).
import { CRYPTO_STRATEGIES } from './crypto/registry';

/** The 10 new strategy modules, in display order. */
export const NEW_STRATEGIES: Strategy[] = [
  TrendFollowingV2,
  MomentumV2,
  MeanReversionV2,
  BreakoutStrategy,
  PullbackInTrend,
  NewsEventStrategy,
  SentimentStrategy,
  StatArbPairs,
  VwapIntraday,
  MarketRegimeOverlay,
];

/** Everything the engine knows about — legacy, then new stock, then crypto. */
export const ALL_STRATEGIES: Strategy[] = [...LEGACY_STRATEGIES, ...NEW_STRATEGIES, ...CRYPTO_STRATEGIES];

export const STRATEGY_BY_INTERNAL_NAME: Record<string, Strategy> = Object.fromEntries(
  ALL_STRATEGIES.map((s) => [s.internalName, s]),
);

/**
 * The strategies an active config should consider:
 *   - honor enable/disable lists,
 *   - drop experimental strategies unless explicitly included,
 *   - always keep overlay/master-filter strategies (they only ever veto/scale).
 */
export function strategiesForConfig(config: ResolvedStrategyConfig): Strategy[] {
  return ALL_STRATEGIES.filter((s) => {
    if (!config.isStrategyEnabled(s.internalName)) return false;
    if (s.overlay) return true;
    if (s.source === 'experimental' && !config.includeExperimental) return false;
    return true;
  });
}
