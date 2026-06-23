import { mutation, query, internalQuery, type MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import { FOUNDER_TIER, isFounderEmail } from './lib/billing';

async function ensureFounderSubscription(
  ctx: MutationCtx,
  clerkId: string,
  email: string,
): Promise<void> {
  if (!isFounderEmail(email)) return;
  const existing = await ctx.db
    .query('subscriptions')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { status: 'ACTIVE', tier: FOUNDER_TIER });
    return;
  }
  await ctx.db.insert('subscriptions', {
    clerkId,
    status: 'ACTIVE',
    tier: FOUNDER_TIER,
  });
}

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
      await ensureFounderSubscription(ctx, clerkId, email);
      return existing._id;
    }

    const userId = await ctx.db.insert('users', {
      clerkId,
      email,
      role: role ?? 'USER',
      status: 'ACTIVE',
      alpacaGuideCompleted: false,
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

    await ensureFounderSubscription(ctx, clerkId, email);
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

/** Upserts the current user — safe to call on every sign-in. */
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

    if (existing) {
      await ensureFounderSubscription(ctx, clerkId, email);
      return existing._id;
    }

    const userId = await ctx.db.insert('users', {
      clerkId,
      email,
      role: 'USER',
      status: 'ACTIVE',
      alpacaGuideCompleted: false,
    });

    await ctx.db.insert('paperAccounts', { clerkId, balance: 100_000, equity: 100_000 });
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
    await ctx.db.insert('subscriptions', { clerkId, status: 'NONE' });
    await ensureFounderSubscription(ctx, clerkId, email);

    return userId;
  },
});


/** Marks the Alpaca linking guide as completed for the current user. */
export const completeAlpacaGuide = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    await ctx.db.patch(user._id, { alpacaGuideCompleted: true });
    return null;
  },
});


/** Internal: load role + email for broker connect entitlement checks. */
export const _getByClerkId = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(
    v.object({
      role: v.union(v.literal('USER'), v.literal('ADMIN'), v.literal('DEVELOPER')),
      email: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!user) return null;
    return { role: user.role, email: user.email };
  },
});
