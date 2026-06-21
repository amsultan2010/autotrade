/**
 * User-facing configuration for the Strategy Engine.
 *
 * `StrategyEngineConfig` is JSON-serializable — see strategy-engine.config.example.json
 * for a sample a user (or a settings UI) can edit. `resolveConfig()` turns it
 * into the concrete knobs the selector + risk manager use, applying the chosen
 * mode's preset and any explicit overrides.
 */
import { DEFAULT_RISK_THRESHOLDS, type RiskThresholds } from './risk';
import type { TradingMode } from './types';

/** What the user writes (config file / settings). All optional except mode. */
export interface StrategyEngineConfig {
  mode: TradingMode; // conservative | balanced | aggressive | paper_only | strategy_specific | auto
  /** Required when mode === 'strategy_specific': the strategy internalName to pin. */
  manualStrategy?: string;
  /** Allow trading in extreme-volatility regimes (off by default). */
  highRiskMode?: boolean;
  /** Active strategies: 'all' (default) or an explicit list of internalNames. */
  enabledStrategies?: 'all' | string[];
  /** Strategies to force off (applied after enabledStrategies). */
  disabledStrategies?: string[];
  /** Override the resolved minimum confidence (0–100). */
  minConfidence?: number;
  /** Partially override the risk thresholds for the chosen mode. */
  thresholds?: Partial<RiskThresholds>;
  /** Include experimental strategies in selection (off by default — they need data). */
  includeExperimental?: boolean;
}

interface ModePreset {
  minConfidence: number;
  thresholds: RiskThresholds;
  agreementBonusPerStrategy: number;
}

/** The three "risk appetite" presets. Other modes inherit 'balanced'. */
const PRESETS: Record<'conservative' | 'balanced' | 'aggressive', ModePreset> = {
  conservative: {
    minConfidence: 75,
    thresholds: { minRR: 2.0, maxSpreadPct: 0.4, minRelativeVolume: 0.8, extremeVolAtrPct: 5 },
    agreementBonusPerStrategy: 4,
  },
  balanced: {
    minConfidence: 60,
    thresholds: DEFAULT_RISK_THRESHOLDS,
    agreementBonusPerStrategy: 5,
  },
  aggressive: {
    minConfidence: 45,
    thresholds: { minRR: 1.2, maxSpreadPct: 1.0, minRelativeVolume: 0.4, extremeVolAtrPct: 8 },
    agreementBonusPerStrategy: 6,
  },
};

/** Concrete settings the selector/risk manager consume. */
export interface ResolvedStrategyConfig {
  mode: TradingMode;
  manualStrategy?: string;
  highRiskMode: boolean;
  minConfidence: number;
  thresholds: RiskThresholds;
  agreementBonusPerStrategy: number;
  /** paper_only forces execution to paper regardless of broker connection. */
  forcePaper: boolean;
  includeExperimental: boolean;
  /** Whether a given strategy internalName is enabled by this config. */
  isStrategyEnabled(internalName: string): boolean;
}

function presetFor(mode: TradingMode): ModePreset {
  if (mode === 'conservative' || mode === 'aggressive') return PRESETS[mode];
  return PRESETS.balanced; // balanced | paper_only | strategy_specific | auto
}

export function resolveConfig(config: StrategyEngineConfig): ResolvedStrategyConfig {
  const preset = presetFor(config.mode);
  const enabled = config.enabledStrategies ?? 'all';
  const disabled = new Set(config.disabledStrategies ?? []);

  // strategy_specific implicitly enables only the pinned strategy.
  const pinned = config.mode === 'strategy_specific' ? config.manualStrategy : undefined;

  return {
    mode: config.mode,
    manualStrategy: config.manualStrategy,
    highRiskMode: config.highRiskMode ?? false,
    minConfidence: config.minConfidence ?? preset.minConfidence,
    thresholds: { ...preset.thresholds, ...config.thresholds },
    agreementBonusPerStrategy: preset.agreementBonusPerStrategy,
    forcePaper: config.mode === 'paper_only',
    includeExperimental: config.includeExperimental ?? false,
    isStrategyEnabled(internalName: string): boolean {
      if (disabled.has(internalName)) return false;
      if (pinned) return internalName === pinned;
      if (enabled === 'all') return true;
      return enabled.includes(internalName);
    },
  };
}

/** A safe default config (balanced, auto-select, paper-first). */
export const DEFAULT_STRATEGY_ENGINE_CONFIG: StrategyEngineConfig = {
  mode: 'balanced',
  highRiskMode: false,
  enabledStrategies: 'all',
  includeExperimental: false,
};
