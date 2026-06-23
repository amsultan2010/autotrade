import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';

type AdminCtx = QueryCtx | MutationCtx;

/** Require Clerk auth and ADMIN or DEVELOPER role. */
export async function requireAdmin(ctx: AdminCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) throw new Error('User not found');
  if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') {
    throw new Error('Forbidden');
  }

  return user;
}
