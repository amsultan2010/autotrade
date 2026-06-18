import { query, internalMutation } from './_generated/server';
import { v } from 'convex/values';

const statusValidator = v.union(
  v.literal('NONE'),
  v.literal('ACTIVE'),
  v.literal('PAST_DUE'),
  v.literal('CANCELED'),
  v.literal('TRIALING'),
);

/** Get the current user's subscription. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

/** Returns true if the user is entitled to Pro features. */
export const isEntitled = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (user && (user.role === 'ADMIN' || user.role === 'DEVELOPER')) return true;

    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    return sub?.status === 'ACTIVE' || sub?.status === 'TRIALING';
  },
});

/** Called from the Stripe webhook to sync subscription state. */
export const syncFromStripe = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    tier: v.optional(v.string()),
    status: statusValidator,
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_customer', (q) => q.eq('stripeCustomerId', args.stripeCustomerId))
      .unique();

    if (sub) {
      await ctx.db.patch(sub._id, {
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
      });
    }
  },
});

/** Link a Stripe customer ID to a user (called after Stripe checkout). */
export const linkStripeCustomer = internalMutation({
  args: { clerkId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, { clerkId, stripeCustomerId }) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (sub) await ctx.db.patch(sub._id, { stripeCustomerId });
  },
});
