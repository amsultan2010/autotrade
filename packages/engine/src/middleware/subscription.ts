/**
 * Subscription / entitlement checks.
 *
 * Tiers:
 *   free — paper trading, no subscription required (anyone with an account)
 *   pro  — live trading + all premium features, requires ACTIVE/TRIALING subscription
 *
 * ADMIN and DEVELOPER bypass all checks.
 */
import { prisma } from '../lib/prisma';
import { PaymentRequiredError, UnauthorizedError } from '../lib/errors';

export function isEntitled(
  role: string,
  sub: { status: string; currentPeriodEnd: Date | null } | null,
  requiredTier: 'free' | 'pro' = 'free',
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (requiredTier === 'free') return true;
  if (!sub) return false;
  const periodOk = !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now();
  return (sub.status === 'ACTIVE' || sub.status === 'TRIALING') && periodOk;
}

export function isProEntitled(
  role: string,
  sub: { status: string; currentPeriodEnd: Date | null } | null,
): boolean {
  return isEntitled(role, sub, 'pro');
}

export async function subscriptionGuard(): Promise<void> {
  // Paywall disabled until Stripe is configured — isEntitled() enforces per-feature.
}
