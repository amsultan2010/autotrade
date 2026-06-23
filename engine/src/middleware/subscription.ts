/**
 * Subscription / entitlement checks.
 *
 * Tiers:
 *   free — paper trading trial (max FREE_PAPER_TRADE_LIMIT trades), no subscription required
 *   pro  — live trading + unlimited paper, requires ACTIVE/TRIALING subscription
 *
 * ADMIN and DEVELOPER bypass all checks.
 */
import { prisma } from '../lib/prisma';
import {
  FREE_PAPER_TRADE_LIMIT,
  canUsePaperTrading as sharedCanUsePaperTrading,
  isProEntitled as sharedIsProEntitled,
  type SubscriptionSnapshot,
} from '@autotrade/shared';

export { FREE_PAPER_TRADE_LIMIT };

export function isProEntitled(
  role: string,
  sub: SubscriptionSnapshot | { status: string; currentPeriodEnd: Date | null } | null,
): boolean {
  return sharedIsProEntitled(role, sub);
}

export function canUsePaperTrading(
  role: string,
  sub: SubscriptionSnapshot | { status: string; currentPeriodEnd: Date | null } | null,
  paperTradeCount: number,
): boolean {
  return sharedCanUsePaperTrading(role, sub, paperTradeCount);
}

/** Count all paper trades ever opened for a user (open + closed). */
export async function countPaperTrades(userId: string): Promise<number> {
  return prisma.trade.count({ where: { userId, mode: 'PAPER' } });
}

/** @deprecated Use isProEntitled for live features or canUsePaperTrading for paper. */
export function isEntitled(
  role: string,
  sub: SubscriptionSnapshot | null,
  requiredTier: 'free' | 'pro' = 'free',
): boolean {
  if (requiredTier === 'pro') return sharedIsProEntitled(role, sub);
  return canUsePaperTrading(role, sub, 0);
}

export async function subscriptionGuard(): Promise<void> {
  // Paywall disabled until Stripe is configured — isEntitled() enforces per-feature.
}
