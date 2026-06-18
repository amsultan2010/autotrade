// Queries and mutations extracted from bot.ts so they run in the V8 runtime.
// (Node.js runtime — bot.ts — can only contain actions.)
import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

/** Fetch all clerkIds of users with an active/non-disabled bot. */
export const _getActiveUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query('botSettings')
      .filter((q) => q.neq(q.field('mode'), 'DISABLED'))
      .collect();

    const results: string[] = [];
    for (const s of settings) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', s.clerkId))
        .unique();
      if (user && user.status === 'ACTIVE') {
        results.push(s.clerkId);
      }
    }
    return results;
  },
});

/** Log a bot cycle result for observability. */
export const _logCycleResult = internalMutation({
  args: {
    clerkId: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    signalsGenerated: v.optional(v.number()),
    tradesOpened: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditLogs', {
      actorClerkId: args.clerkId,
      action: 'bot_cycle',
      meta: {
        success: args.success,
        error: args.error,
        signalsGenerated: args.signalsGenerated,
        tradesOpened: args.tradesOpened,
      },
      createdAt: Date.now(),
    });
  },
});
