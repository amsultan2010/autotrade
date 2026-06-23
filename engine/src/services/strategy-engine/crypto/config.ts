/**
 * Crypto user config + modes. JSON-serializable; resolveCryptoConfig() turns a
 * user's choice into concrete knobs (confidence floor, exposure caps, leverage
 * gates, enabled strategies). Leverage/perps/futures stay OFF unless high-risk
 * mode is explicitly turned on.
 */
import { DEFAULT_CRYPTO_RISK, type CryptoRiskConfig } from './risk';

export const CRYPTO_MODES = [
  'conservative_crypto',
  'balanced_crypto',
  'aggressive_crypto',
  'paper_crypto', // no real trades; real data; logs performance
  'manual_crypto', // user pins one crypto strategy
  'auto_crypto', // bot chooses
] as const;
export type CryptoMode = (typeof CRYPTO_MODES)[number];

export interface CryptoEngineConfig {
  mode: CryptoMode;
  manualStrategy?: string; // required for manual_crypto
  enabledStrategies?: 'all' | string[];
  disabledStrategies?: string[];
  includeExperimental?: boolean; // funding/OI/on-chain/news — need data feeds
  highRiskMode?: boolean; // enables leverage/perps/futures (with smaller size)
  minConfidence?: number;
  risk?: Partial<CryptoRiskConfig>;
}

interface CryptoModePreset {
  minConfidence: number;
  risk: CryptoRiskConfig;
  majorsOnly: boolean; // conservative: BTC/ETH + top coins only
  allowHighVolCoins: boolean;
}

const PRESETS: Record<'conservative_crypto' | 'balanced_crypto' | 'aggressive_crypto', CryptoModePreset> = {
  conservative_crypto: {
    minConfidence: 75,
    risk: { ...DEFAULT_CRYPTO_RISK, maxPerCoinPct: 10, maxAltcoinExposurePct: 25, maxOpenCryptoPositions: 4, minVolume24hUsd: 25_000_000, maxSpreadPct: 0.3 },
    majorsOnly: true,
    allowHighVolCoins: false,
  },
  balanced_crypto: {
    minConfidence: 60,
    risk: DEFAULT_CRYPTO_RISK,
    majorsOnly: false,
    allowHighVolCoins: false,
  },
  aggressive_crypto: {
    minConfidence: 48,
    risk: { ...DEFAULT_CRYPTO_RISK, maxPerCoinPct: 30, maxAltcoinExposurePct: 70, maxOpenCryptoPositions: 12 },
    majorsOnly: false,
    allowHighVolCoins: true,
  },
};

export interface ResolvedCryptoConfig {
  mode: CryptoMode;
  manualStrategy?: string;
  minConfidence: number;
  includeExperimental: boolean;
  highRiskMode: boolean;
  majorsOnly: boolean;
  allowHighVolCoins: boolean;
  risk: CryptoRiskConfig;
  forcePaper: boolean; // paper_crypto
  isStrategyEnabled(internalName: string): boolean;
}

function presetFor(mode: CryptoMode): CryptoModePreset {
  if (mode === 'conservative_crypto' || mode === 'aggressive_crypto') return PRESETS[mode];
  return PRESETS.balanced_crypto; // balanced | paper | manual | auto
}

export function resolveCryptoConfig(cfg: CryptoEngineConfig): ResolvedCryptoConfig {
  const preset = presetFor(cfg.mode);
  const risk: CryptoRiskConfig = { ...preset.risk, ...cfg.risk };
  // High-risk mode is the ONLY way to enable leverage/perps/futures, and even
  // then the crypto risk manager still applies smaller exposure caps.
  if (cfg.highRiskMode) {
    risk.allowLeverage = true;
    risk.allowPerps = true;
    risk.allowFutures = true;
    risk.spotOnly = false;
  }
  const enabled = cfg.enabledStrategies ?? 'all';
  const disabled = new Set(cfg.disabledStrategies ?? []);
  const pinned = cfg.mode === 'manual_crypto' ? cfg.manualStrategy : undefined;

  return {
    mode: cfg.mode,
    manualStrategy: cfg.manualStrategy,
    minConfidence: cfg.minConfidence ?? preset.minConfidence,
    includeExperimental: cfg.includeExperimental ?? false,
    highRiskMode: cfg.highRiskMode ?? false,
    majorsOnly: preset.majorsOnly,
    allowHighVolCoins: preset.allowHighVolCoins,
    risk,
    forcePaper: cfg.mode === 'paper_crypto',
    isStrategyEnabled(internalName: string): boolean {
      if (disabled.has(internalName)) return false;
      if (pinned) return internalName === pinned;
      if (enabled === 'all') return true;
      return enabled.includes(internalName);
    },
  };
}

export const DEFAULT_CRYPTO_CONFIG: CryptoEngineConfig = {
  mode: 'balanced_crypto',
  highRiskMode: false,
  includeExperimental: false,
};
