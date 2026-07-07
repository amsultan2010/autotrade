import {
  getEffectiveTierFromSubscription,
  getLimitsForSubscription,
  isBillingEnabledEnv,
  isFounderTestEmail,
  isLiveTradingTier,
  canUseScanInterval,
  normalizePlanTier,
  mustUsePaperSimulator as sharedMustUsePaperSimulator,
  canUsePaperTrading as sharedCanUsePaperTrading,
  maxExecutionsPerDay as sharedMaxExecutionsPerDay,
  maxPresetSwitchesPerWeek as sharedMaxPresetSwitchesPerWeek,
  canUseExperimentalStrategies as sharedCanUseExperimental,
  canUseCrypto as sharedCanUseCrypto,
  canUseAdvancedAnalytics as sharedCanUseAdvancedAnalytics,
  canUsePremiumAnalytics as sharedCanUsePremiumAnalytics,
  canAccessQuantTools as sharedCanAccessQuantTools,
  type EffectiveTier,
  type PlanTier,
} from '@autotrade/shared';

export type { EffectiveTier, PlanTier };

export interface SubscriptionSnapshot {
  status: string;
  tier?: string | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean | null;
  legacyTier?: string | null;
  legacyTierUntil?: number | null;
}

function periodActive(currentPeriodEnd?: number | null): boolean {
  if (currentPeriodEnd == null) return true;
  return currentPeriodEnd > Date.now();
}

export function getEffectiveTier(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): EffectiveTier {
  return getEffectiveTierFromSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    sub?.currentPeriodEnd ?? null,
    role,
    email,
    sub?.legacyTier ?? null,
    sub?.legacyTierUntil ?? null,
    founderPlanOverride,
  );
}

export function getPlanLimits(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
) {
  return getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    sub?.currentPeriodEnd ?? null,
    role,
    email,
    sub?.legacyTier ?? null,
    sub?.legacyTierUntil ?? null,
    founderPlanOverride,
  );
}

export function requiresPaperSimulator(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return false;
  return sharedMustUsePaperSimulator(role, sub, email, founderPlanOverride);
}

export function canUsePaperTrading(
  role: string,
  sub: SubscriptionSnapshot | null,
  paperTradeCount: number,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return sharedCanUsePaperTrading(role, sub, paperTradeCount, email, founderPlanOverride);
}

export function hasLiveTradingAccess(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  const limits = getPlanLimits(role, sub, email, founderPlanOverride);
  if (!limits?.liveTrading) return false;
  if (isFounderTestEmail(email)) return true;
  if (!isBillingEnabledEnv()) return false;
  if (!sub) return false;
  if (sub.status === 'PAST_DUE' || sub.status === 'UNPAID') return false;
  return (
    (sub.status === 'ACTIVE' || sub.status === 'TRIALING') &&
    periodActive(sub.currentPeriodEnd) &&
    isLiveTradingTier(sub.tier ?? null) &&
    limits.liveTrading === true
  );
}

export function isLiveEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return hasLiveTradingAccess(role, sub, email, founderPlanOverride);
}

export function canAccessScanInterval(
  role: string,
  sub: SubscriptionSnapshot | null,
  seconds: number,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  const tier = getEffectiveTier(role, sub, email, founderPlanOverride);
  return canUseScanInterval(tier, seconds);
}

export function countActiveStrategies(stockStrategies: string[], cryptoStrategies: string[]): number {
  return new Set([...stockStrategies, ...cryptoStrategies]).size;
}

export function normalizeStoredTier(tier: string | null | undefined): string | null {
  return normalizePlanTier(tier);
}

export function maxPresetSwitchesPerWeek(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): number | null {
  return sharedMaxPresetSwitchesPerWeek(role, sub, email, founderPlanOverride);
}

export function canUseExperimentalStrategies(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return sharedCanUseExperimental(role, sub, email, founderPlanOverride);
}

export function canUseCrypto(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return sharedCanUseCrypto(role, sub, email, founderPlanOverride);
}

export function canUseAdvancedAnalytics(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return sharedCanUseAdvancedAnalytics(role, sub, email, founderPlanOverride);
}

export function canUsePremiumAnalytics(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return sharedCanUsePremiumAnalytics(role, sub, email, founderPlanOverride);
}

export function canAccessQuantTools(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): boolean {
  return sharedCanAccessQuantTools(role, sub, email, founderPlanOverride);
}

export function maxExecutionsPerDay(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: EffectiveTier | null,
): number | null {
  return sharedMaxExecutionsPerDay(role, sub, email, founderPlanOverride);
}

export { mustUsePaperSimulator as mustUsePaperSimulatorFromShared } from '@autotrade/shared';

export function isBillingEnabled(): boolean {
  return isBillingEnabledEnv();
}
