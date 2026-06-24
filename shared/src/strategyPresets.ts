import {
  DEFAULT_CRYPTO_STRATEGIES,
} from './strategies.js';

export type StrategyPresetRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StrategyPreset {
  id: string;
  label: string;
  description: string;
  stockStrategies: readonly string[];
  cryptoStrategies: readonly string[];
  includeExperimental?: boolean;
  riskLevel?: StrategyPresetRiskLevel;
  minConfidence?: number;
}

/** Sentinel id when the user's selection does not match a built-in preset. */
export const CUSTOM_PRESET_ID = 'custom';

const CORE_STOCK = [
  'trend_following_v2',
  'momentum_v2',
  'mean_reversion_v2',
  'breakout_v1',
  'pullback_in_trend_v1',
] as const;

const CORE_CRYPTO = [...DEFAULT_CRYPTO_STRATEGIES];

const EXPERIMENTAL_STOCK = [
  'news_event_v1',
  'sentiment_v1',
  'stat_arb_pairs_v1',
  'vwap_intraday_v1',
] as const;

const EXPERIMENTAL_CRYPTO = [
  'crypto_funding_perp',
  'crypto_oi_liquidation',
  'crypto_onchain_flow',
  'crypto_news_narrative',
] as const;

const LEGACY_STOCK = [
  'legacy_trend_breakout',
  'legacy_pullback_continuation',
  'legacy_mean_reversion',
] as const;

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description:
      'Core strategies across stocks and crypto. A sensible default mix of trend, momentum, and mean reversion.',
    stockStrategies: CORE_STOCK,
    cryptoStrategies: CORE_CRYPTO,
    includeExperimental: false,
    riskLevel: 'MEDIUM',
    minConfidence: 60,
  },
  {
    id: 'conservative',
    label: 'Conservative',
    description:
      'Fewer strategies with higher confidence thresholds. Trend and mean reversion only — suited to choppy or uncertain markets.',
    stockStrategies: [
      'trend_following_v2',
      'mean_reversion_v2',
      'pullback_in_trend_v1',
    ],
    cryptoStrategies: ['crypto_trend_following', 'crypto_mean_reversion'],
    includeExperimental: false,
    riskLevel: 'LOW',
    minConfidence: 70,
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description:
      'All core and experimental strategies enabled. Lower confidence bar for more signals — higher risk, higher activity.',
    stockStrategies: [...CORE_STOCK, ...EXPERIMENTAL_STOCK],
    cryptoStrategies: [...CORE_CRYPTO, ...EXPERIMENTAL_CRYPTO],
    includeExperimental: true,
    riskLevel: 'HIGH',
    minConfidence: 50,
  },
  {
    id: 'trend_hunter',
    label: 'Trend Hunter',
    description:
      'Momentum and breakout focused. Best when markets are trending strongly in one direction.',
    stockStrategies: [
      'trend_following_v2',
      'momentum_v2',
      'breakout_v1',
      'pullback_in_trend_v1',
    ],
    cryptoStrategies: [
      'crypto_trend_following',
      'crypto_momentum',
      'crypto_breakout',
    ],
    includeExperimental: false,
    riskLevel: 'MEDIUM',
    minConfidence: 60,
  },
  {
    id: 'mean_reversion',
    label: 'Mean Reversion',
    description:
      'Contrarian and range-bound strategies. Looks for oversold bounces and overbought fades.',
    stockStrategies: ['mean_reversion_v2', 'vwap_intraday_v1'],
    cryptoStrategies: ['crypto_mean_reversion'],
    includeExperimental: true,
    riskLevel: 'LOW',
    minConfidence: 65,
  },
  {
    id: 'stocks_only',
    label: 'Stocks Only',
    description:
      'Full stock strategy suite with crypto disabled. For users who only trade shares and ETFs.',
    stockStrategies: CORE_STOCK,
    cryptoStrategies: [],
    includeExperimental: false,
    riskLevel: 'MEDIUM',
    minConfidence: 60,
  },
  {
    id: 'crypto_only',
    label: 'Crypto Only',
    description:
      'All core crypto strategies with stocks disabled. Runs 24/7 on your crypto watchlist.',
    stockStrategies: [],
    cryptoStrategies: CORE_CRYPTO,
    includeExperimental: false,
    riskLevel: 'MEDIUM',
    minConfidence: 60,
  },
  {
    id: 'legacy',
    label: 'Legacy Engine',
    description:
      'Original autotrade strategies from the first engine. For users who prefer the classic behaviour.',
    stockStrategies: LEGACY_STOCK,
    cryptoStrategies: ['legacy_crypto_momentum'],
    includeExperimental: false,
    riskLevel: 'MEDIUM',
    minConfidence: 60,
  },
];

export const CUSTOM_PRESET: StrategyPreset = {
  id: CUSTOM_PRESET_ID,
  label: 'Custom',
  description:
    'Pick individual strategies below. Your current selection does not match a preset.',
  stockStrategies: [],
  cryptoStrategies: [],
};

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

function idsEqual(a: readonly string[], b: readonly string[]): boolean {
  const sa = sortedIds(a);
  const sb = sortedIds(b);
  if (sa.length !== sb.length) return false;
  return sa.every((id, i) => id === sb[i]);
}

export interface StrategyPresetMatchInput {
  stockStrategies: string[];
  cryptoStrategies: string[];
  includeExperimental: boolean;
  riskLevel?: StrategyPresetRiskLevel;
  minConfidence?: number;
}

/** Returns the id of the matching built-in preset, or `custom`. */
export function detectActivePreset(settings: StrategyPresetMatchInput): string {
  for (const preset of STRATEGY_PRESETS) {
    if (!idsEqual(settings.stockStrategies, preset.stockStrategies)) continue;
    if (!idsEqual(settings.cryptoStrategies, preset.cryptoStrategies)) continue;
    if ((preset.includeExperimental ?? false) !== settings.includeExperimental) {
      continue;
    }
    if (preset.riskLevel !== undefined && preset.riskLevel !== settings.riskLevel) {
      continue;
    }
    if (
      preset.minConfidence !== undefined &&
      preset.minConfidence !== settings.minConfidence
    ) {
      continue;
    }
    return preset.id;
  }
  return CUSTOM_PRESET_ID;
}

export interface PresetAppliedSettings {
  stockStrategies: string[];
  cryptoStrategies: string[];
  includeExperimental: boolean;
  riskLevel?: StrategyPresetRiskLevel;
  minConfidence?: number;
}

/** Build a settings patch from a preset id. Returns null for custom. */
export function applyStrategyPreset(
  presetId: string,
): PresetAppliedSettings | null {
  if (presetId === CUSTOM_PRESET_ID) return null;

  const preset = STRATEGY_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  return {
    stockStrategies: [...preset.stockStrategies],
    cryptoStrategies: [...preset.cryptoStrategies],
    includeExperimental: preset.includeExperimental ?? false,
    ...(preset.riskLevel !== undefined ? { riskLevel: preset.riskLevel } : {}),
    ...(preset.minConfidence !== undefined
      ? { minConfidence: preset.minConfidence }
      : {}),
  };
}

/** All presets shown in the UI, including Custom. */
export function getAllPresetOptions(): StrategyPreset[] {
  return [...STRATEGY_PRESETS, CUSTOM_PRESET];
}

/** Default preset id for new users. */
export const DEFAULT_PRESET_ID = 'balanced';
