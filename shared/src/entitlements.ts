import { FREE_PAPER_TRADE_LIMIT } from './constants.js';

export interface SubscriptionSnapshot {
  status: string;
  currentPeriodEnd?: number | Date | null;
}

function periodActive(currentPeriodEnd?: number | Date | null): boolean {
  if (currentPeriodEnd == null) return true;
  const endMs =
    currentPeriodEnd instanceof Date ? currentPeriodEnd.getTime() : currentPeriodEnd;
  return endMs > Date.now();
}

/** True if the user has an active Pro subscription (or admin/dev bypass). */
export function isProEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (!sub) return false;
  return (sub.status === 'ACTIVE' || sub.status === 'TRIALING') && periodActive(sub.currentPeriodEnd);
}

/** True if the user may open paper trades / enable paper bot mode. */
export function canUsePaperTrading(
  role: string,
  sub: SubscriptionSnapshot | null,
  paperTradeCount: number,
): boolean {
  if (isProEntitled(role, sub)) return true;
  return paperTradeCount < FREE_PAPER_TRADE_LIMIT;
}

export function paperTradesRemaining(
  role: string,
  sub: SubscriptionSnapshot | null,
  paperTradeCount: number,
): number {
  if (isProEntitled(role, sub)) return FREE_PAPER_TRADE_LIMIT;
  return Math.max(0, FREE_PAPER_TRADE_LIMIT - paperTradeCount);
}
