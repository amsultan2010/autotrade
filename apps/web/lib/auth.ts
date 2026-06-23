import { auth } from '@clerk/nextjs/server';
import { createClerkClient } from '@clerk/backend';
import { prisma, env, DEFAULT_WATCHLIST, UnauthorizedError, ForbiddenError } from '@autotrade/engine/public';

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError('Not signed in');

  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user) {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!email) throw new UnauthorizedError('Clerk user has no primary email');
    const normalized = email.trim().toLowerCase();

    user = await prisma.user.upsert({
      where: { email: normalized },
      update: { clerkId: userId },
      create: {
        email: normalized,
        clerkId: userId,
        passwordHash: '',
        paperAccount: { create: { balance: env.PAPER_STARTING_BALANCE, equity: env.PAPER_STARTING_BALANCE } },
        botSettings: { create: {} },
        subscription: { create: { status: 'NONE' } },
        watchlist: { create: DEFAULT_WATCHLIST },
      },
      select: { id: true, email: true, role: true, status: true },
    });
  }

  if (user.status === 'DISABLED') throw new ForbiddenError('This account has been disabled');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') {
    throw new ForbiddenError('Insufficient privileges');
  }
  return user;
}
