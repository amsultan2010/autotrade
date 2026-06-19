import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

function requireAuth(identity: { subject: string } | null): string {
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}

/** List trades for the current user with optional filters and cursor pagination. */
export const list = query({
  args: {
    result: v.optional(
      v.union(v.literal('OPEN'), v.literal('WIN'), v.literal('LOSS'), v.literal('BREAKEVEN')),
    ),
    mode: v.optional(
      v.union(v.literal('DISABLED'), v.literal('PAPER'), v.literal('LIVE')),
    ),
    symbol: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { result, mode, symbol, limit = 100, cursor }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { items: [], nextCursor: null };
    const clerkId = identity.subject;

    let q = ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (qi) => qi.eq('clerkId', clerkId))
      .order('desc');

    const all = await q.collect();

    // Apply filters in memory (Convex doesn't support multi-field filter chaining on non-indexed fields).
    const filtered = all.filter((t) => {
      if (result && t.result !== result) return false;
      if (mode && t.mode !== mode) return false;
      if (symbol && t.symbol !== symbol.toUpperCase()) return false;
      return true;
    });

    // Manual cursor pagination.
    const startIdx = cursor ? filtered.findIndex((t) => t._id === cursor) + 1 : 0;
    const page = filtered.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < filtered.length;

    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?._id ?? null : null,
    };
  },
});

/** Get a single trade by ID. */
export const get = query({
  args: { id: v.id('trades') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const trade = await ctx.db.get(id);
    if (!trade || trade.clerkId !== identity.subject) return null;
    return trade;
  },
});

/** Create a new trade from a signal decision. */
export const create = mutation({
  args: {
    signalId: v.optional(v.id('signals')),
    symbol: v.string(),
    exchange: v.string(),
    side: v.union(v.literal('LONG'), v.literal('SHORT')),
    mode: v.union(v.literal('DISABLED'), v.literal('PAPER'), v.literal('LIVE')),
    qty: v.number(),
    entryPrice: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    strategy: v.string(),
    confidence: v.number(),
    entryReason: v.string(),
    entrySnapshot: v.optional(v.any()),
    brokerOrderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    return ctx.db.insert('trades', {
      clerkId,
      ...args,
      symbol: args.symbol.toUpperCase(),
      result: 'OPEN',
      mistakeTags: [],
      openedAt: Date.now(),
    });
  },
});

/** Close an open trade, computing PnL and result. */
export const close = mutation({
  args: {
    id: v.id('trades'),
    exitPrice: v.number(),
    exitReason: v.optional(v.string()),
    mistakeTags: v.optional(v.array(v.string())),
    reasoningCorrect: v.optional(v.boolean()),
    exitSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, { id, exitPrice, exitReason, mistakeTags, reasoningCorrect, exitSnapshot }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const trade = await ctx.db.get(id);
    if (!trade || trade.clerkId !== clerkId) throw new Error('Trade not found');
    if (trade.result !== 'OPEN') throw new Error('Trade is already closed');

    const rawPnl = trade.side === 'LONG'
      ? (exitPrice - trade.entryPrice) * trade.qty
      : (trade.entryPrice - exitPrice) * trade.qty;
    const pnl = Math.round(rawPnl * 100) / 100;

    let result: 'WIN' | 'LOSS' | 'BREAKEVEN';
    if (pnl > 0) result = 'WIN';
    else if (pnl < 0) result = 'LOSS';
    else result = 'BREAKEVEN';

    await ctx.db.patch(id, {
      exitPrice,
      pnl,
      result,
      exitReason,
      mistakeTags: mistakeTags ?? [],
      reasoningCorrect,
      exitSnapshot,
      closedAt: Date.now(),
    });

    return { pnl, result };
  },
});

/** Update mistake tags and reasoning flag on a closed trade (post-review). */
export const annotate = mutation({
  args: {
    id: v.id('trades'),
    mistakeTags: v.array(v.string()),
    reasoningCorrect: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, mistakeTags, reasoningCorrect }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const trade = await ctx.db.get(id);
    if (!trade || trade.clerkId !== clerkId) throw new Error('Trade not found');

    await ctx.db.patch(id, { mistakeTags, reasoningCorrect });
  },
});
