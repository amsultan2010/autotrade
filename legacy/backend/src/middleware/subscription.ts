/**
 * subscriptionGuard — server-side entitlement check (req #2, #6).
 * Admins and developers bypass payment (req #3). Everyone else needs an
 * ACTIVE (or TRIALING) subscription whose period has not ended.
 *
 * Must run AFTER authGuard.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { PaymentRequiredError, UnauthorizedError } from '../lib/errors.js';
import { isProd } from '../config/env.js';
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

export async function countPaperTrades(userId: string): Promise<number> {
  return prisma.trade.count({ where: { userId, mode: 'PAPER' } });
}

/** @deprecated Use isProEntitled for live features. */
export function isEntitled(
  role: string,
  sub: { status: string; currentPeriodEnd: Date | null } | null,
  requiredTier: 'free' | 'pro' = 'free',
): boolean {
  if (requiredTier === 'pro') return sharedIsProEntitled(role, sub);
  return canUsePaperTrading(role, sub, 0);
}

export async function subscriptionGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // PAYWALL DISABLED — re-enable by uncommenting the block below when Stripe is set up.
  // In production the guard is enforced regardless, to prevent accidental open access.
  if (isProd) {
    const user = req.authUser;
    if (!user) throw new UnauthorizedError();
    if (user.role === 'ADMIN' || user.role === 'DEVELOPER') return;
    const sub = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { status: true, currentPeriodEnd: true },
    });
    if (!isProEntitled(user.role, sub)) throw new PaymentRequiredError();
    return;
  }
  // Dev/test: paywall bypassed so the app can be used without Stripe configured.
}
