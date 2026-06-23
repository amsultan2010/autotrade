import { query, type QueryCtx } from './_generated/server';
import {
  FREE_PAPER_TRADE_LIMIT,
  canUsePaperTrading,
  isProEntitled,
} from '@autotrade/shared';

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

/** Get the current user's subscription record. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

/** Returns true if the user is entitled to Pro features. */
export const isEntitled = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const { user, sub } = await getUserAndSub(ctx, identity.subject);
    return isProEntitled(user?.role ?? 'USER', sub);
  },
});

/** Paper trial usage for free-tier users. */
export const getPaperTrial = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const { user, sub } = await getUserAndSub(ctx, identity.subject);
    const used = await paperTradeCount(ctx, identity.subject);
    const role = user?.role ?? 'USER';
    return {
      paperTradesUsed: used,
      paperTradesLimit: FREE_PAPER_TRADE_LIMIT,
      canUsePaperTrading: canUsePaperTrading(role, sub, used),
      entitled: isProEntitled(role, sub),
    };
  },
});
