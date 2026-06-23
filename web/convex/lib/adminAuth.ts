import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';

type AdminCtx = QueryCtx | MutationCtx;

/** Require an authenticated Clerk user; surfaces a client-readable ConvexError. */
export function requireAuth(identity: { subject: string } | null): string {
  if (!identity) throw new ConvexError('Unauthenticated');
  return identity.subject;
}

/** Require Clerk auth and ADMIN or DEVELOPER role. */
export async function requireAdmin(ctx: AdminCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  const clerkId = requireAuth(identity);

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();

  if (!user) throw new ConvexError('User not found');
  if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') {
    throw new ConvexError('Forbidden');
  }

  return user;
}
