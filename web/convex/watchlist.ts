import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { requireAuth } from './lib/adminAuth';


/** List all watched symbols for the current user (ordered by add time asc). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query('watchedSymbols')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .order('asc')
      .collect();
  },
});

/** Add a symbol to the watchlist (idempotent). */
export const add = mutation({
  args: {
    symbol: v.string(),
    exchange: v.string(),
    mic: v.optional(v.string()),
  },
  handler: async (ctx, { symbol, exchange, mic }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const upper = symbol.toUpperCase();

    // Check for duplicate.
    const existing = await ctx.db
      .query('watchedSymbols')
      .withIndex('by_clerk_symbol_exchange', (q) =>
        q.eq('clerkId', clerkId).eq('symbol', upper).eq('exchange', exchange),
      )
      .unique();

    if (existing) return existing._id;

    return ctx.db.insert('watchedSymbols', {
      clerkId,
      symbol: upper,
      exchange,
      mic,
      addedAt: Date.now(),
    });
  },
});

/** Remove a watched symbol by document ID. */
export const remove = mutation({
  args: { id: v.id('watchedSymbols') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const item = await ctx.db.get(id);
    if (!item || item.clerkId !== clerkId) throw new ConvexError('Not found');
    await ctx.db.delete(id);
  },
});
