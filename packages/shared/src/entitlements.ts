import { FREE_PAPER_TRADE_LIMIT, FREE_PAPER_BALANCE_CAP, FREE_DAILY_EXECUTION_LIMIT } from './constants.js';
import {
  getEffectiveTierFromSubscription,
  getLimitsForSubscription,
  isBillingEnabledEnv,
  isFounderTestEmail,
  isLiveTradingTier,
  type EffectiveTier as BillingEffectiveTier,
} from './billing.js';
import { FREE_TIER_LIMITS, type EffectiveTier } from './plans.js';

export interface SubscriptionSnapshot {
  status: string;
  tier?: string | null;
  currentPeriodEnd?: number | Date | null;
  cancelAtPeriodEnd?: boolean | null;
  legacyTier?: string | null;
  legacyTierUntil?: number | Date | null;
}

function periodActive(currentPeriodEnd?: number | Date | null): boolean {
  if (currentPeriodEnd == null) return true;
  const endMs =
    currentPeriodEnd instanceof Date ? currentPeriodEnd.getTime() : currentPeriodEnd;
  return endMs > Date.now();
}

function toPeriodEndMs(currentPeriodEnd?: number | Date | null): number | null {
  if (currentPeriodEnd == null) return null;
  return currentPeriodEnd instanceof Date ? currentPeriodEnd.getTime() : currentPeriodEnd;
}

function toMs(value?: number | Date | null): number | null {
  if (value == null) return null;
  return value instanceof Date ? value.getTime() : value;
}

export function getEffectiveTier(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): EffectiveTier {
  return getEffectiveTierFromSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier ?? null,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
}

/** Free users: internal paper simulator only. Paid users: live Alpaca. */
export function mustUsePaperSimulator(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return false;
  return getEffectiveTier(role, sub, email, founderPlanOverride) === 'free';
}

/** True if the user may use live / real-money autotrade via Alpaca. */
export function hasLiveTradingAccess(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier ?? null,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  if (!limits?.liveTrading) return false;
  if (isFounderTestEmail(email)) return true;
  if (!isBillingEnabledEnv()) return false;
  if (!sub) return false;
  if (sub.status === 'PAST_DUE' || sub.status === 'UNPAID') return false;
  return (
    (sub.status === 'ACTIVE' || sub.status === 'TRIALING') &&
    periodActive(sub.currentPeriodEnd) &&
    isLiveTradingTier(sub.tier ?? null)
  );
}

/** @deprecated Use hasLiveTradingAccess */
export function isLiveEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  return hasLiveTradingAccess(role, sub, email, founderPlanOverride);
}

/** @deprecated Use hasLiveTradingAccess */
export function isProEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  return hasLiveTradingAccess(role, sub, email, founderPlanOverride);
}

/** Paper simulator available to free users (and admins). */
export function canUsePaperTrading(
  role: string,
  sub: SubscriptionSnapshot | null,
  paperTradeCount: number,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (!mustUsePaperSimulator(role, sub, email, founderPlanOverride)) return false;
  return paperTradeCount < FREE_TIER_LIMITS.maxPaperTrades;
}

export function maxPaperBalance(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): number {
  if (mustUsePaperSimulator(role, sub, email, founderPlanOverride)) return FREE_PAPER_BALANCE_CAP;
  return Infinity;
}

export function maxExecutionsPerDay(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): number | null {
  if (mustUsePaperSimulator(role, sub, email, founderPlanOverride)) return FREE_DAILY_EXECUTION_LIMIT;
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.maxExecutionsPerDay ?? null;
}

export function canUseCrypto(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.crypto ?? false;
}

export function canUseExperimentalStrategies(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.experimentalStrategies ?? false;
}

export function canUseAdvancedAnalytics(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.advancedAnalytics ?? false;
}

export function canUsePremiumAnalytics(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.premiumAnalytics ?? false;
}

export function canAccessQuantTools(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): boolean {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.quantToolsAccess ?? false;
}

export function maxPresetSwitchesPerWeek(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): number | null {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.maxPresetSwitchesPerWeek ?? null;
}

export function maxActiveStrategies(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
  founderPlanOverride?: BillingEffectiveTier | null,
): number | null {
  const limits = getLimitsForSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    toPeriodEndMs(sub?.currentPeriodEnd),
    role,
    email,
    sub?.legacyTier,
    toMs(sub?.legacyTierUntil),
    founderPlanOverride,
  );
  return limits?.maxActiveStrategies ?? null;
}

export function paperTradesRemaining(
  role: string,
  sub: SubscriptionSnapshot | null,
  paperTradeCount: number,
): number {
  if (!mustUsePaperSimulator(role, sub)) return FREE_PAPER_TRADE_LIMIT;
  return Math.max(0, FREE_TIER_LIMITS.maxPaperTrades - paperTradeCount);
}
