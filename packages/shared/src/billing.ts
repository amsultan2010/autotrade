import {
  type EffectiveTier,
  type PlanTier,
  limitsForTier,
  normalizePlanTier,
  resolveEffectiveTier,
  tierRank,
} from './plans.js';

export {
  PLAN_TIERS,
  PLAN_DEFINITIONS,
  TIER_COLORS,
  FREE_TIER,
  type PlanTier,
  type EffectiveTier,
  type PlanLimits,
  type PlanDefinition,
  scanIntervalTier,
  minTierForScanInterval,
  canUseScanInterval,
  selectableScanIntervalsForTier,
  normalizePlanTier,
  tierFromStripeLookupKey,
  QUANT_TOOL_LINKS,
  TRIAL_PERIOD_DAYS,
  trialEligibleTier,
  clampScanIntervalForTier,
  minTierForFeature,
  FREE_TIER_LIMITS,
  resolveEffectiveTier,
  limitsForTier,
  tierRank,
  ALL_SCAN_INTERVAL_SECONDS,
} from './plans.js';

/** Paid tiers that unlock live trading when billing is enabled. */
export const LIVE_TRADING_TIERS = ['essential', 'pro', 'unlimited'] as const;
export type LiveTradingTier = (typeof LIVE_TRADING_TIERS)[number];

/** Dev/founder bypass tier — not sold via Stripe. */
export const FOUNDER_TIER = 'founder' as const;

const DEFAULT_FOUNDER_EMAIL = 'abdullahmsultan1@gmail.com';

/** Internal team emails that can override plan tier for product testing. */
export const FOUNDER_TEST_EMAILS = [
  'abdullahmsultan1@gmail.com',
  'connortorres2027@gmail.com',
  'prestonhk13@gmail.com',
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when Stripe checkout and paid tiers are active. */
export function isBillingEnabledEnv(): boolean {
  return process.env.BILLING_ENABLED === 'true';
}

/** True when launch promo prices should be used at checkout. */
export function useLaunchPricesEnv(): boolean {
  return process.env.STRIPE_USE_LAUNCH_PRICES !== 'false';
}

export function isFounderTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return (FOUNDER_TEST_EMAILS as readonly string[]).includes(normalized);
}

export function founderLiveEmailEnv(): string {
  return normalizeEmail(process.env.FOUNDER_LIVE_EMAIL ?? DEFAULT_FOUNDER_EMAIL);
}

export function isLiveTradingTier(tier: string | null | undefined): boolean {
  const normalized = normalizePlanTier(tier);
  if (!normalized) return tier === FOUNDER_TIER;
  return (LIVE_TRADING_TIERS as readonly string[]).includes(normalized);
}

export function getEffectiveTierFromSubscription(
  tier: string | null | undefined,
  status: string,
  currentPeriodEnd?: number | null,
  role?: string,
  email?: string | null,
  legacyTier?: string | null,
  legacyTierUntil?: number | null,
  founderPlanOverride?: EffectiveTier | null,
): EffectiveTier {
  if (role === 'ADMIN' || role === 'DEVELOPER') return 'unlimited';
  if (isFounderTestEmail(email) && founderPlanOverride != null) return founderPlanOverride;
  if (isFounderTestEmail(email)) return 'unlimited';
  if (email && normalizeEmail(email) === founderLiveEmailEnv()) return 'unlimited';
  return resolveEffectiveTier(tier, status, currentPeriodEnd, legacyTier, legacyTierUntil);
}

export function hasTierAtLeast(current: EffectiveTier, required: PlanTier): boolean {
  return tierRank(current) >= tierRank(required);
}

export function getLimitsForSubscription(
  tier: string | null | undefined,
  status: string,
  currentPeriodEnd?: number | null,
  role?: string,
  email?: string | null,
  legacyTier?: string | null,
  legacyTierUntil?: number | null,
  founderPlanOverride?: EffectiveTier | null,
) {
  const effective = getEffectiveTierFromSubscription(
    tier,
    status,
    currentPeriodEnd,
    role,
    email,
    legacyTier,
    legacyTierUntil,
    founderPlanOverride,
  );
  return limitsForTier(effective);
}
