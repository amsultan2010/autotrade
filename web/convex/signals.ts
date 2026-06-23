import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth } from './lib/adminAuth';


/** List the most recent signals for the current user. */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query('signals')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .order('desc')
      .take(limit);
  },
});

/** Record a new signal emitted by the bot engine. */
export const create = mutation({
  args: {
    ticker: v.string(),
    exchange: v.string(),
    price: v.number(),
    timeframe: v.string(),
    strategy: v.string(),
    action: v.union(
      v.literal('BUY'),
      v.literal('SELL'),
      v.literal('HOLD'),
      v.literal('AVOID'),
      v.literal('CLOSE'),
    ),
    confidence: v.number(),
    riskLevel: v.union(v.literal('LOW'), v.literal('MEDIUM'), v.literal('HIGH')),
    entryReason: v.string(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    rrRatio: v.optional(v.number()),
    explanation: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    return ctx.db.insert('signals', {
      clerkId,
      ...args,
      createdAt: Date.now(),
    });
  },
});
