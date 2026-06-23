import { auth, createClerkClient } from '@clerk/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { env, ForbiddenError, UnauthorizedError } from '@autotrade/engine/public';
import { convexToken } from './convex-auth-token';

export interface AuthUser {
  /** Clerk user id — used as the primary identifier in Convex. */
  id: string;
  clerkId: string;
  email: string;
  role: string;
  status: string;
}

export async function requireUser(): Promise<AuthUser> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError('Not signed in');

  const token = await convexToken();
  let user = await fetchQuery(api.users.me, {}, { token });

  if (!user) {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!email) throw new UnauthorizedError('Clerk user has no primary email');

    await fetchMutation(api.users.ensureExists, { email }, { token });
    user = await fetchQuery(api.users.me, {}, { token });
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
