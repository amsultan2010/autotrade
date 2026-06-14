/**
 * subscriptionGuard — server-side entitlement check (req #2, #6).
 * Admins and developers bypass payment (req #3). Everyone else needs an
 * ACTIVE (or TRIALING) subscription whose period has not ended.
 *
 * Must run AFTER authGuard.
 */
import { prisma } from '../lib/prisma';
import { PaymentRequiredError, UnauthorizedError } from '../lib/errors';

export function isEntitled(
  role: string,
  sub: { status: string; currentPeriodEnd: Date | null } | null,
): boolean {
  if (role === 'ADMIN' || role === 'DEVELOPER') return true;
  if (!sub) return false;
  const periodOk = !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now();
  return (sub.status === 'ACTIVE' || sub.status === 'TRIALING') && periodOk;
}

export async function subscriptionGuard(): Promise<void> {
  // PAYWALL DISABLED — re-enable when Stripe is set up
  // const user = req.authUser;
  // if (!user) throw new UnauthorizedError();
  // if (user.role === 'ADMIN' || user.role === 'DEVELOPER') return;
  // const sub = await prisma.subscription.findUnique({
  //   where: { userId: user.id },
  //   select: { status: true, currentPeriodEnd: true },
  // });
  // if (!isEntitled(user.role, sub)) throw new PaymentRequiredError();
}
