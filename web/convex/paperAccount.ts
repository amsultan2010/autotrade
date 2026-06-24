import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { PAPER_STARTING_BALANCE } from '@autotrade/shared';
import { requireAuth } from './lib/adminAuth';


/** Get the current user's paper trading account. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('paperAccounts')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
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

    if (!account) throw new ConvexError('Paper account not found');
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

    if (!account) throw new ConvexError('Paper account not found');
    await ctx.db.patch(account._id, {
      balance: PAPER_STARTING_BALANCE,
      equity: PAPER_STARTING_BALANCE,
    });
  },
});
