/** Subscription plan identifiers (Stripe lookup_key / tier). */
export const PLAN_TIERS = ['essential', 'pro', 'unlimited'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const FREE_TIER = 'free' as const;
export type EffectiveTier = typeof FREE_TIER | PlanTier;

/** External quant tools (Pro+). */
export const QUANT_TOOL_LINKS = [
  { label: 'Quant Portfolio', href: 'https://quantportfoliopy.vercel.app' },
  { label: 'Quant Backtester', href: 'https://quantbacktesterpy.vercel.app' },
  { label: 'Quant Options', href: 'https://quantoptionspy.vercel.app' },
] as const;

/** Visual accent colors for tier-gated UI (bronze / silver / gold). */
export const TIER_COLORS: Record<PlanTier, { accent: string; accentDim: string; border: string }> = {
  essential: {
    accent: '#ff8c1a',
    accentDim: 'rgba(255, 140, 26, 0.28)',
    border: 'rgba(255, 140, 26, 0.72)',
  },
  pro: {
    accent: '#f8fafc',
    accentDim: 'rgba(248, 250, 252, 0.2)',
    border: 'rgba(248, 250, 252, 0.65)',
  },
  unlimited: {
    accent: '#ffea00',
    accentDim: 'rgba(255, 234, 0, 0.24)',
    border: 'rgba(255, 234, 0, 0.7)',
  },
};

export const FREE_TIER_COLOR = '#9ca3af';

export function tierDisplayColor(tier: EffectiveTier): string {
  if (tier === 'free') return FREE_TIER_COLOR;
  return TIER_COLORS[tier].accent;
}

export function tierDisplayLabel(tier: EffectiveTier): string {
  if (tier === 'free') return 'Free';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export interface FreeTierLimits {
  maxPaperBalance: number;
  maxPaperTrades: number;
  maxExecutionsPerDay: number;
  paperOnly: true;
}

export const FREE_TIER_LIMITS: FreeTierLimits = {
  maxPaperBalance: 10_000,
  maxPaperTrades: 500,
  maxExecutionsPerDay: 25,
  paperOnly: true,
};

export interface PlanLimits {
  /** Live Alpaca equity cap; null = unlimited */
  maxAccountBalance: number | null;
  maxExecutionsPerDay: number | null;
  maxActiveStrategies: number | null;
  /** Preset switches allowed per calendar week; null = unlimited */
  maxPresetSwitchesPerWeek: number | null;
  scanIntervalMin: number;
  scanIntervalMax: number;
  stocks: boolean;
  crypto: boolean;
  liveTrading: boolean;
  /** Win rate, total PnL, open trades */
  basicAnalytics: boolean;
  /** Strategy/symbol breakdown, confidence trends */
  advancedAnalytics: boolean;
  /** Drawdown deep-dive, extended equity analytics */
  premiumAnalytics: boolean;
  quantToolsAccess: boolean;
  experimentalStrategies: boolean;
  prioritySupport: boolean;
  premiumSupport: boolean;
  highestExecutionPriority: boolean;
  earlyAccess: boolean;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  priceMonthly: number;
  launchPriceMonthly: number;
  features: string[];
  limits: PlanLimits;
}

const ESSENTIAL_LIMITS: PlanLimits = {
  maxAccountBalance: 1_000,
  maxExecutionsPerDay: 50,
  maxActiveStrategies: 1,
  maxPresetSwitchesPerWeek: 1,
  scanIntervalMin: 35,
  scanIntervalMax: 44,
  stocks: true,
  crypto: false,
  liveTrading: true,
  basicAnalytics: true,
  advancedAnalytics: false,
  premiumAnalytics: false,
  quantToolsAccess: false,
  experimentalStrategies: false,
  prioritySupport: false,
  premiumSupport: false,
  highestExecutionPriority: false,
  earlyAccess: false,
};

const PRO_LIMITS: PlanLimits = {
  maxAccountBalance: 5_000,
  maxExecutionsPerDay: 250,
  maxActiveStrategies: 5,
  maxPresetSwitchesPerWeek: 5,
  scanIntervalMin: 20,
  scanIntervalMax: 34,
  stocks: true,
  crypto: true,
  liveTrading: true,
  basicAnalytics: true,
  advancedAnalytics: true,
  premiumAnalytics: false,
  quantToolsAccess: true,
  experimentalStrategies: false,
  prioritySupport: true,
  premiumSupport: false,
  highestExecutionPriority: false,
  earlyAccess: false,
};

const UNLIMITED_LIMITS: PlanLimits = {
  maxAccountBalance: null,
  maxExecutionsPerDay: null,
  maxActiveStrategies: null,
  maxPresetSwitchesPerWeek: null,
  scanIntervalMin: 1,
  scanIntervalMax: 19,
  stocks: true,
  crypto: true,
  liveTrading: true,
  basicAnalytics: true,
  advancedAnalytics: true,
  premiumAnalytics: true,
  quantToolsAccess: true,
  experimentalStrategies: true,
  prioritySupport: true,
  premiumSupport: true,
  highestExecutionPriority: true,
  earlyAccess: true,
};

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  essential: {
    id: 'essential',
    name: 'Essential',
    priceMonthly: 15,
    launchPriceMonthly: 15,
    features: [
      'Stocks only (paper simulator for free users)',
      'Live trading via Alpaca',
      'Max live equity: $1,000',
      'Max 50 trade executions/day',
      '1 active strategy',
      '1 preset switch/week',
      'Scan intervals: 35–44 sec',
      'Basic analytics',
      '48-hr trial available from Free',
    ],
    limits: ESSENTIAL_LIMITS,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 25,
    launchPriceMonthly: 20,
    features: [
      'Everything in Essential',
      'Stocks + Crypto',
      'Max live equity: $5,000',
      'Max 250 trade executions/day',
      'Up to 5 active strategies',
      '5 preset switches/week',
      'Scan intervals: 20–34 sec',
      'Advanced analytics + quant tool links',
      'Priority email support',
      '48-hr trial available from Essential',
    ],
    limits: PRO_LIMITS,
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    priceMonthly: 50,
    launchPriceMonthly: 40,
    features: [
      'Everything in Pro',
      'Unlimited live equity',
      'Unlimited executions',
      'Unlimited strategies & preset switches',
      'Scan intervals: 1–19 sec',
      'Premium analytics & experimental strategies',
      'Highest execution priority',
      'Premium email support (fastest response)',
      'Early access to new features',
    ],
    limits: UNLIMITED_LIMITS,
  },
};

/** 48-hr trial on the tier directly above current (Unlimited excluded). */
export function trialEligibleTier(current: EffectiveTier): PlanTier | null {
  switch (current) {
    case 'free':
      return 'essential';
    case 'essential':
      return 'pro';
    default:
      return null;
  }
}

export const TRIAL_PERIOD_DAYS = 2;

export function scanIntervalTier(seconds: number): PlanTier | null {
  if (seconds >= 35 && seconds <= 44) return 'essential';
  if (seconds >= 20 && seconds <= 34) return 'pro';
  if (seconds >= 1 && seconds <= 19) return 'unlimited';
  return null;
}

export function isPlanTier(value: string | null | undefined): value is PlanTier {
  return value != null && (PLAN_TIERS as readonly string[]).includes(value);
}

export function minTierForScanInterval(seconds: number): PlanTier {
  return scanIntervalTier(seconds) ?? 'unlimited';
}

export function minTierForFeature(feature: 'crypto' | 'experimental' | 'quantTools' | 'advancedAnalytics' | 'premiumAnalytics'): PlanTier {
  switch (feature) {
    case 'crypto':
    case 'quantTools':
    case 'advancedAnalytics':
      return 'pro';
    case 'experimental':
    case 'premiumAnalytics':
      return 'unlimited';
    default:
      return 'essential';
  }
}

export const ALL_SCAN_INTERVAL_SECONDS = Array.from({ length: 44 }, (_, i) => i + 1);

export function tierRank(tier: EffectiveTier): number {
  switch (tier) {
    case 'free':
      return 0;
    case 'essential':
      return 1;
    case 'pro':
      return 2;
    case 'unlimited':
      return 3;
    default:
      return 0;
  }
}

export function resolveEffectiveTier(
  tier: string | null | undefined,
  status: string,
  currentPeriodEnd?: number | null,
  legacyTier?: string | null,
  legacyTierUntil?: number | null,
): EffectiveTier {
  if (status === 'PAST_DUE' || status === 'UNPAID' || status === 'CANCELED' || status === 'NONE') {
    return FREE_TIER;
  }

  const normalized = normalizePlanTier(tier);
  if (!normalized) return FREE_TIER;

  const periodActive = currentPeriodEnd == null || currentPeriodEnd > Date.now();
  if ((status === 'ACTIVE' || status === 'TRIALING') && periodActive) {
    const legacy = normalizePlanTier(legacyTier);
    if (
      legacy &&
      legacyTierUntil != null &&
      legacyTierUntil > Date.now() &&
      tierRank(legacy) > tierRank(normalized)
    ) {
      return legacy;
    }
    return normalized;
  }

  return FREE_TIER;
}

export function limitsForTier(tier: EffectiveTier): PlanLimits | null {
  if (tier === FREE_TIER) return null;
  return PLAN_DEFINITIONS[tier].limits;
}

export function canUseScanInterval(effectiveTier: EffectiveTier, seconds: number): boolean {
  const required = minTierForScanInterval(seconds);
  return tierRank(effectiveTier) >= tierRank(required);
}

export function selectableScanIntervalsForTier(tier: EffectiveTier): number[] {
  return ALL_SCAN_INTERVAL_SECONDS.filter((s) => canUseScanInterval(tier, s));
}

export function normalizePlanTier(tier: string | null | undefined): PlanTier | null {
  if (!tier) return null;
  const base = tier.replace(/_launch$/, '');
  const map: Record<string, PlanTier> = {
    starter: 'essential',
    essential: 'essential',
    pro: 'pro',
    elite: 'unlimited',
    unlimited: 'unlimited',
    founder: 'unlimited',
  };
  return map[base] ?? null;
}

export function tierFromStripeLookupKey(lookupKey: string | null | undefined): PlanTier | null {
  return normalizePlanTier(lookupKey);
}

/** Clamp bot settings when a paid period ends at a lower tier. */
export function clampScanIntervalForTier(tier: EffectiveTier, seconds: number): number {
  if (tier === FREE_TIER) return 44;
  const limits = PLAN_DEFINITIONS[tier].limits;
  if (seconds >= limits.scanIntervalMin && seconds <= limits.scanIntervalMax) return seconds;
  return limits.scanIntervalMax;
}
