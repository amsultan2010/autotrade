/** Strategy-engine internal names for stocks and crypto. */

export const DEFAULT_STOCK_STRATEGIES = [
  'trend_following_v2',
  'momentum_v2',
  'mean_reversion_v2',
  'breakout_v1',
  'pullback_in_trend_v1',
  'vwap_intraday_v1',
  'stat_arb_pairs_v1',
] as const;

export const DEFAULT_CRYPTO_STRATEGIES = [
  'crypto_trend_following',
  'crypto_momentum',
  'crypto_mean_reversion',
  'crypto_breakout',
] as const;

export const LEGACY_STRATEGY_ID_MAP: Record<string, string> = {
  TrendBreakout: 'legacy_trend_breakout',
  PullbackContinuation: 'legacy_pullback_continuation',
  MeanReversion: 'legacy_mean_reversion',
  CryptoMomentum: 'legacy_crypto_momentum',
};

const LEGACY_STOCK_IDS = new Set(['TrendBreakout', 'PullbackContinuation', 'MeanReversion']);

export function resolveStrategyLists(settings: {
  strategies: string[];
  stockStrategies?: string[];
  cryptoStrategies?: string[];
}): { stockStrategies: string[]; cryptoStrategies: string[] } {
  if (settings.stockStrategies?.length || settings.cryptoStrategies?.length) {
    return {
      stockStrategies: settings.stockStrategies?.length
        ? [...settings.stockStrategies]
        : [...DEFAULT_STOCK_STRATEGIES],
      cryptoStrategies: settings.cryptoStrategies?.length
        ? [...settings.cryptoStrategies]
        : [...DEFAULT_CRYPTO_STRATEGIES],
    };
  }

  if (settings.strategies.length > 0) {
    const stock: string[] = [];
    const crypto: string[] = [];
    for (const id of settings.strategies) {
      const internal = LEGACY_STRATEGY_ID_MAP[id];
      if (!internal) continue;
      if (id === 'CryptoMomentum') crypto.push(internal);
      else if (LEGACY_STOCK_IDS.has(id)) stock.push(internal);
    }
    return {
      stockStrategies: stock.length > 0 ? stock : [...DEFAULT_STOCK_STRATEGIES],
      cryptoStrategies: crypto.length > 0 ? crypto : [...DEFAULT_CRYPTO_STRATEGIES],
    };
  }

  return {
    stockStrategies: [...DEFAULT_STOCK_STRATEGIES],
    cryptoStrategies: [...DEFAULT_CRYPTO_STRATEGIES],
  };
}
