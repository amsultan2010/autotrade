import {
  founderLiveEmail,
  isBillingEnabled,
  isLiveTradingTier,
  normalizeEmail,
} from './billing';

export interface SubscriptionSnapshot {
  status: string;
  tier?: string | null;
  currentPeriodEnd?: number | null;
}

function periodActive(currentPeriodEnd?: number | null): boolean {
  if (currentPeriodEnd == null) return true;
  return currentPeriodEnd > Date.now();
}

/** True if the user may use live / real-money trading. */
export function hasLiveTradingAccess(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (email && normalizeEmail(email) === founderLiveEmail()) return true;
  if (!isBillingEnabled()) return false;
  if (!sub) return false;
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
): boolean {
  return hasLiveTradingAccess(role, sub, email);
}

/** Paper trading is always available for every user. */
export function canUsePaperTrading(): boolean {
  return true;
}
