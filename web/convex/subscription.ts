import { query, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { canUsePaperTrading, isLiveEntitled } from './lib/entitlements';

async function paperTradeCount(ctx: QueryCtx, clerkId: string): Promise<number> {
  const trades = await ctx.db
    .query('trades')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .collect();
  return trades.filter((t) => t.mode === 'PAPER').length;
}

async function getUserAndSub(ctx: QueryCtx, clerkId: string) {
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();
  const sub = await ctx.db
    .query('subscriptions')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();
  return { user, sub };
}

const subscriptionReturn = v.union(
  v.object({
    _id: v.id('subscriptions'),
    _creationTime: v.number(),
    clerkId: v.string(),
    tier: v.optional(v.string()),
    status: v.union(
      v.literal('NONE'),
      v.literal('ACTIVE'),
      v.literal('PAST_DUE'),
      v.literal('CANCELED'),
      v.literal('TRIALING'),
    ),
    currentPeriodEnd: v.optional(v.number()),
  }),
  v.null(),
);

/** Get the current user's subscription record. */
export const get = query({
  args: {},
  returns: subscriptionReturn,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

/** Returns true if the user is entitled to live trading. */
export const isEntitled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const { user, sub } = await getUserAndSub(ctx, identity.subject);
    return isLiveEntitled(user?.role ?? 'USER', sub);
  },
});

/** Paper trading usage stats (paper is always allowed). */
export const getPaperTrial = query({
  args: {},
  returns: v.union(
    v.object({
      paperTradesUsed: v.number(),
      canUsePaperTrading: v.boolean(),
      entitled: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const { user, sub } = await getUserAndSub(ctx, identity.subject);
    const used = await paperTradeCount(ctx, identity.subject);
    const role = user?.role ?? 'USER';
    return {
      paperTradesUsed: used,
      canUsePaperTrading: canUsePaperTrading(),
      entitled: isLiveEntitled(role, sub),
    };
  },
});
