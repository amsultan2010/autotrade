// Queries and mutations extracted from bot.ts so they run in the V8 runtime.
// (Node.js runtime — bot.ts — can only contain actions.)
import { internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Read a user's bot config — settings + watchlist — by clerkId.
 *
 * Convex is the source of truth for what the user configures in the UI, but the
 * trading engine still reads Postgres. The bot bridge (/api/internal/bot/run-user)
 * calls this via the secret-guarded server HTTP client to mirror that config
 * into Postgres before each cycle, so the engine honors the user's real
 * watchlist and settings. Returns no sensitive data — safe to expose.
 */
export const getConfigForBot = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const settings = await ctx.db
      .query('botSettings')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    const watched = await ctx.db
      .query('watchedSymbols')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    return {
      settings: settings
        ? {
            mode: settings.mode,
            riskLevel: settings.riskLevel,
            maxActiveTrades: settings.maxActiveTrades,
            maxTradeSize: settings.maxTradeSize,
            riskPerTradePct: settings.riskPerTradePct,
            defaultStopPct: settings.defaultStopPct,
            defaultTakeProfitPct: settings.defaultTakeProfitPct,
            maxDailyLoss: settings.maxDailyLoss,
            tradingHoursStart: settings.tradingHoursStart,
            tradingHoursEnd: settings.tradingHoursEnd,
            minConfidence: settings.minConfidence,
            timeframes: settings.timeframes,
            strategies: settings.strategies,
          }
        : null,
      watchlist: watched.map((w) => ({
        symbol: w.symbol,
        exchange: w.exchange,
        mic: w.mic ?? null,
      })),
    };
  },
});

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
