import { FREE_PAPER_TRADE_LIMIT } from './constants.js';
import {
  founderLiveEmailEnv,
  isBillingEnabledEnv,
  isLiveTradingTier,
  normalizeEmail,
} from './billing.js';

export interface SubscriptionSnapshot {
  status: string;
  tier?: string | null;
  currentPeriodEnd?: number | Date | null;
}

function periodActive(currentPeriodEnd?: number | Date | null): boolean {
  if (currentPeriodEnd == null) return true;
  const endMs =
    currentPeriodEnd instanceof Date ? currentPeriodEnd.getTime() : currentPeriodEnd;
  return endMs > Date.now();
}

/** True if the user may use live / real-money autotrade. */
export function hasLiveTradingAccess(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (email && normalizeEmail(email) === founderLiveEmailEnv()) return true;
  if (!isBillingEnabledEnv()) return false;
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

/** @deprecated Use hasLiveTradingAccess */
export function isProEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
  email?: string | null,
): boolean {
  return hasLiveTradingAccess(role, sub, email);
}

/** True if the user may open paper trades / enable paper bot mode. */
export function canUsePaperTrading(
  _role: string,
  _sub: SubscriptionSnapshot | null,
  _paperTradeCount: number,
): boolean {
  return true;
}

export function paperTradesRemaining(
  role: string,
  sub: SubscriptionSnapshot | null,
  paperTradeCount: number,
): number {
  if (hasLiveTradingAccess(role, sub)) return FREE_PAPER_TRADE_LIMIT;
  return Math.max(0, FREE_PAPER_TRADE_LIMIT - paperTradeCount);
}
