import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth } from './lib/adminAuth';


/** Get all strategy stats for the current user. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const clerkId = identity.subject;
    return ctx.db
      .query('strategyStats')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();
  },
});

/** Upsert strategy stat — called by the engine after each closed trade. */
export const upsert = mutation({
  args: {
    strategy: v.string(),
    symbol: v.string(),
    won: v.boolean(),
    pnl: v.number(),
    confidence: v.number(),
  },
  handler: async (ctx, { strategy, symbol, won, pnl, confidence }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const existing = await ctx.db
      .query('strategyStats')
      .withIndex('by_clerk_strategy_symbol', (q) =>
        q.eq('clerkId', clerkId).eq('strategy', strategy).eq('symbol', symbol),
      )
      .unique();

    if (existing) {
      const trades = existing.trades + 1;
      const wins = existing.wins + (won ? 1 : 0);
      const losses = existing.losses + (won ? 0 : 1);
      const totalPnl = existing.totalPnl + pnl;
      const expectancy = totalPnl / trades;

      // Confidence multiplier: converges toward win rate * 2, clamped to [0.5, 1.5].
      const winRate = wins / trades;
      const raw = 0.5 + winRate;
      const weightedConfidence = Math.max(0.5, Math.min(1.5, raw));

      await ctx.db.patch(existing._id, {
        trades,
        wins,
        losses,
        totalPnl,
        expectancy,
        weightedConfidence,
      });
    } else {
      await ctx.db.insert('strategyStats', {
        clerkId,
        strategy,
        symbol,
        trades: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        totalPnl: pnl,
        expectancy: pnl,
        weightedConfidence: 1.0,
      });
    }
  },
});
