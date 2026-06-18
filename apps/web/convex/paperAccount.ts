import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

function requireAuth(identity: { subject: string } | null): string {
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}

/** Get the current user's paper trading account. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);
    return ctx.db
      .query('paperAccounts')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
  },
});

/** Update balance and equity (called by the paper trading engine). */
export const update = mutation({
  args: {
    balance: v.number(),
    equity: v.number(),
  },
  handler: async (ctx, { balance, equity }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const account = await ctx.db
      .query('paperAccounts')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!account) throw new Error('Paper account not found');
    await ctx.db.patch(account._id, { balance, equity });
    return ctx.db.get(account._id);
  },
});

/** Reset paper account to $100k (for testing). */
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const account = await ctx.db
      .query('paperAccounts')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!account) throw new Error('Paper account not found');
    await ctx.db.patch(account._id, { balance: 100_000, equity: 100_000 });
  },
});
