/** Live trading requires an active paid subscription (any tier). */

export interface SubscriptionSnapshot {
  status: string;
  currentPeriodEnd?: number | null;
}

function periodActive(currentPeriodEnd?: number | null): boolean {
  if (currentPeriodEnd == null) return true;
  return currentPeriodEnd > Date.now();
}

/** True if the user may use live / real-money trading. */
export function isLiveEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (!sub) return false;
  return (
    (sub.status === 'ACTIVE' || sub.status === 'TRIALING') &&
    periodActive(sub.currentPeriodEnd)
  );
}

/** Paper trading is always available for every user. */
export function canUsePaperTrading(): boolean {
  return true;
}
