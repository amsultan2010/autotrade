import { query, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

const positionValidator = v.object({
  symbol: v.string(),
  qty: v.number(),
  avgEntryPrice: v.number(),
  side: v.union(v.literal('LONG'), v.literal('SHORT')),
  currentPrice: v.optional(v.number()),
  marketValue: v.optional(v.number()),
  unrealizedPnl: v.optional(v.number()),
  unrealizedPnlPct: v.optional(v.number()),
});

export const snapshotValidator = v.object({
  _id: v.id('brokerSnapshots'),
  _creationTime: v.number(),
  clerkId: v.string(),
  equity: v.number(),
  cash: v.number(),
  buyingPower: v.number(),
  lastEquity: v.optional(v.number()),
  mode: v.union(v.literal('paper'), v.literal('live')),
  positions: v.array(positionValidator),
  syncedAt: v.number(),
  syncError: v.optional(v.string()),
});

/** Latest cached Alpaca account snapshot for the signed-in user. */
export const getSnapshot = query({
  args: {},
  returns: v.union(snapshotValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('brokerSnapshots')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

export const _getSnapshot = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return ctx.db
      .query('brokerSnapshots')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
  },
});

export const _upsertSnapshot = internalMutation({
  args: {
    clerkId: v.string(),
    equity: v.number(),
    cash: v.number(),
    buyingPower: v.number(),
    lastEquity: v.optional(v.number()),
    mode: v.union(v.literal('paper'), v.literal('live')),
    positions: v.array(positionValidator),
    syncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkId, syncError, ...data } = args;
    const existing = await ctx.db
      .query('brokerSnapshots')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    const doc = {
      clerkId,
      ...data,
      syncedAt: Date.now(),
      syncError,
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return ctx.db.insert('brokerSnapshots', doc);
  },
});

export const _deleteSnapshot = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const existing = await ctx.db
      .query('brokerSnapshots')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
