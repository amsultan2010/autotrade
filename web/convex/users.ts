import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/** Called from the Clerk webhook (user.created) to sync a new user into Convex. */
export const syncFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    role: v.optional(v.union(v.literal('USER'), v.literal('ADMIN'), v.literal('DEVELOPER'))),
  },
  handler: async (ctx, { clerkId, email, role }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { email });
      return existing._id;
    }

    const userId = await ctx.db.insert('users', {
      clerkId,
      email,
      role: role ?? 'USER',
      status: 'ACTIVE',
    });

    // Seed paper account and default bot settings for every new user.
    await ctx.db.insert('paperAccounts', {
      clerkId,
      balance: 100_000,
      equity: 100_000,
    });

    await ctx.db.insert('botSettings', {
      clerkId,
      mode: 'PAPER',
      riskLevel: 'MEDIUM',
      maxActiveTrades: 5,
      maxTradeSize: 10_000,
      riskPerTradePct: 1.0,
      defaultStopPct: 2.0,
      defaultTakeProfitPct: 4.0,
      maxDailyLoss: 2_000,
      tradingHoursStart: '09:30',
      tradingHoursEnd: '16:00',
      minConfidence: 60,
      timeframes: ['5m', '15m', '1h', '1d'],
      strategies: ['TrendBreakout', 'PullbackContinuation', 'MeanReversion', 'CryptoMomentum'],
    });

    await ctx.db.insert('subscriptions', {
      clerkId,
      status: 'NONE',
    });

    return userId;
  },
});

/** Called from the Clerk webhook (user.deleted) to mark a user disabled.
 *  Returns the user's email so the caller can unsubscribe them from mailing lists. */
export const disableFromClerk = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, { status: 'DISABLED' });
      return user.email;
    }
    return null;
  },
});

/** Returns the current authenticated user's profile. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

/**
 * Upserts the current user AND backfills any missing sub-records — safe to call
 * on every sign-in (idempotent).
 *
 * Previously this returned early whenever the `users` row already existed, which
 * meant an account that had a `users` row but was MISSING its `botSettings` /
 * `paperAccount` / `subscription` (e.g. the Clerk webhook fired partially, or an
 * older sync ran) stayed permanently broken — Settings never loaded and the bot
 * couldn't start. Now each sub-record is ensured independently so those accounts
 * self-heal on the next sign-in.
 */
export const ensureExists = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');
    const clerkId = identity.subject;

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    const userId =
      existing?._id ??
      (await ctx.db.insert('users', { clerkId, email, role: 'USER', status: 'ACTIVE' }));

    // Backfill any missing sub-records (idempotent).
    const [paperAccount, botSettings, subscription] = await Promise.all([
      ctx.db.query('paperAccounts').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
      ctx.db.query('botSettings').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
      ctx.db.query('subscriptions').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
    ]);

    if (!paperAccount) {
      await ctx.db.insert('paperAccounts', { clerkId, balance: 100_000, equity: 100_000 });
    }
    if (!botSettings) {
      await ctx.db.insert('botSettings', {
        clerkId,
        mode: 'PAPER',
        riskLevel: 'MEDIUM',
        maxActiveTrades: 5,
        maxTradeSize: 10_000,
        riskPerTradePct: 1.0,
        defaultStopPct: 2.0,
        defaultTakeProfitPct: 4.0,
        maxDailyLoss: 2_000,
        tradingHoursStart: '09:30',
        tradingHoursEnd: '16:00',
        minConfidence: 60,
        timeframes: ['5m', '15m', '1h', '1d'],
        strategies: ['TrendBreakout', 'PullbackContinuation', 'MeanReversion', 'CryptoMomentum'],
      });
    }
    if (!subscription) {
      await ctx.db.insert('subscriptions', { clerkId, status: 'NONE' });
    }

    return userId;
  },
});
