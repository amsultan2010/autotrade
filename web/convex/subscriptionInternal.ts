import { mutation, query, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { requireInternalSecret } from './lib/internalSecret';

const subscriptionStatus = v.union(
  v.literal('NONE'),
  v.literal('ACTIVE'),
  v.literal('PAST_DUE'),
  v.literal('CANCELED'),
  v.literal('TRIALING'),
);

const subscriptionRecord = v.union(
  v.object({
    _id: v.id('subscriptions'),
    _creationTime: v.number(),
    clerkId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    tier: v.optional(v.string()),
    status: subscriptionStatus,
    currentPeriodEnd: v.optional(v.number()),
  }),
  v.null(),
);

async function upsertSubscription(
  ctx: { db: import('./_generated/server').MutationCtx['db'] },
  args: {
    clerkId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    tier?: string;
    status: 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
    currentPeriodEnd?: number;
  },
) {
  const existing = await ctx.db
    .query('subscriptions')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
    .unique();

  const patch = {
    stripeCustomerId: args.stripeCustomerId,
    stripeSubscriptionId: args.stripeSubscriptionId,
    tier: args.tier,
    status: args.status,
    currentPeriodEnd: args.currentPeriodEnd,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return ctx.db.insert('subscriptions', {
    clerkId: args.clerkId,
    ...patch,
  });
}

/** Stripe webhook / engine: upsert subscription state from Stripe. */
export const upsertFromStripe = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    tier: v.optional(v.string()),
    status: subscriptionStatus,
    currentPeriodEnd: v.optional(v.number()),
  },
  returns: v.id('subscriptions'),
  handler: async (ctx, args) => {
    requireInternalSecret(args.secret);
    return upsertSubscription(ctx, args);
  },
});

/** Resolve a subscription by Stripe customer id (webhook fan-in). */
export const getByStripeCustomerId = query({
  args: {
    secret: v.string(),
    stripeCustomerId: v.string(),
  },
  returns: subscriptionRecord,
  handler: async (ctx, { secret, stripeCustomerId }) => {
    requireInternalSecret(secret);
    return ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_customer_id', (q) => q.eq('stripeCustomerId', stripeCustomerId))
      .unique();
  },
});

/** Checkout bootstrap: return existing Stripe customer id if any. */
export const getCheckoutData = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
  },
  returns: v.object({
    stripeCustomerId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { secret, clerkId }) => {
    requireInternalSecret(secret);
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    return { stripeCustomerId: sub?.stripeCustomerId ?? null };
  },
});

/** Persist Stripe customer id before checkout session creation. */
export const setStripeCustomerId = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  returns: v.id('subscriptions'),
  handler: async (ctx, { secret, clerkId, stripeCustomerId }) => {
    requireInternalSecret(secret);
    return upsertSubscription(ctx, {
      clerkId,
      stripeCustomerId,
      status: 'NONE',
    });
  },
});

/** Engine entitlement snapshot (no Clerk session required). */
export const getStatusData = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
  },
  returns: v.object({
    role: v.union(v.literal('USER'), v.literal('ADMIN'), v.literal('DEVELOPER')),
    status: subscriptionStatus,
    tier: v.union(v.string(), v.null()),
    currentPeriodEnd: v.union(v.number(), v.null()),
    paperTradesUsed: v.number(),
    email: v.string(),
  }),
  handler: async (ctx, { secret, clerkId }) => {
    requireInternalSecret(secret);

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    return {
      role: user?.role ?? 'USER',
      status: sub?.status ?? 'NONE',
      tier: sub?.tier ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      paperTradesUsed: trades.filter((t) => t.mode === 'PAPER').length,
      email: user?.email ?? '',
    };
  },
});


/** Internal: subscription snapshot for entitlement checks. */
export const _getByClerkId = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(
    v.object({
      status: subscriptionStatus,
      tier: v.optional(v.string()),
      currentPeriodEnd: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, { clerkId }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!sub) return null;
    return {
      status: sub.status,
      tier: sub.tier,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  },
});
