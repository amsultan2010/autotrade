import { auth, createClerkClient } from '@clerk/nextjs/server';
import { env, ForbiddenError, UnauthorizedError } from '@autotrade/engine/public';
import { ensureExists, me } from '@/lib/db/users';

export interface AuthUser {
  /** Clerk user id — used as the primary identifier. */
  id: string;
  clerkId: string;
  email: string;
  role: string;
  status: string;
}

export async function requireUser(): Promise<AuthUser> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError('Not signed in');

  let user = await me(userId);

  if (!user) {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!email) throw new UnauthorizedError('Clerk user has no primary email');

    await ensureExists(userId, email);
    user = await me(userId);
  }

  if (!user) throw new UnauthorizedError('User profile not found');
  if (user.status === 'DISABLED') throw new ForbiddenError('This account has been disabled');

  return {
    id: user.clerkId,
    clerkId: user.clerkId,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') {
    throw new ForbiddenError('Insufficient privileges');
  }
  return user;
}
