/**
 * Subscription service. Stripe drives state changes via webhooks; Convex is the
 * source of truth for entitlement. Webhook handling lives in the Next.js route.
 */
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { env } from '../config/env';
import { getStripe } from '../lib/stripe';
import { AppError } from '../lib/errors';
import { canUsePaperTrading, isProEntitled } from '../middleware/subscription';
import { FREE_PAPER_TRADE_LIMIT } from '@autotrade/shared';
import type { SubscriptionInfo, SubscriptionStatus } from '@autotrade/shared';

type SubscriptionStatusArg = SubscriptionStatus;

function convexUrl(): string {
  const url = env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new AppError(503, 'CONFIG_ERROR', 'CONVEX_URL is not configured');
  }
  return url;
}

function internalSecret(): string {
  if (!env.BOT_INTERNAL_SECRET) {
    throw new AppError(503, 'CONFIG_ERROR', 'BOT_INTERNAL_SECRET is not configured');
  }
  return env.BOT_INTERNAL_SECRET;
}

let convexClient: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
  if (!convexClient) {
    convexClient = new ConvexHttpClient(convexUrl());
  }
  return convexClient;
}

const getCheckoutData = makeFunctionReference<
  'query',
  { secret: string; clerkId: string },
  { stripeCustomerId: string | null }
>('subscriptionInternal:getCheckoutData');

const setStripeCustomerId = makeFunctionReference<
  'mutation',
  { secret: string; clerkId: string; stripeCustomerId: string },
  string
>('subscriptionInternal:setStripeCustomerId');

const getStatusData = makeFunctionReference<
  'query',
  { secret: string; clerkId: string },
  {
    role: 'USER' | 'ADMIN' | 'DEVELOPER';
    status: SubscriptionStatusArg;
    tier: string | null;
    currentPeriodEnd: number | null;
    paperTradesUsed: number;
    email: string;
  }
>('subscriptionInternal:getStatusData');

/** Create (or reuse) a Stripe customer for a user, then a Checkout Session. */
export async function createCheckoutSession(
  clerkId: string,
  email: string,
): Promise<{ url: string }> {
  if (!env.BILLING_ENABLED) {
    throw new AppError(503, 'BILLING_DISABLED', 'Billing is not enabled');
  }
  if (!env.STRIPE_PRICE_ID) {
    throw new AppError(503, 'BILLING_UNCONFIGURED', 'No price configured');
  }

  const stripe = getStripe();
  const convex = getConvex();
  const secret = internalSecret();

  const checkout = await convex.query(getCheckoutData, { secret, clerkId });
  let customerId = checkout.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { clerkId },
    });
    customerId = customer.id;
    await convex.mutation(setStripeCustomerId, {
      secret,
      clerkId,
      stripeCustomerId: customerId,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: env.CHECKOUT_SUCCESS_URL,
    cancel_url: env.CHECKOUT_CANCEL_URL,
    client_reference_id: clerkId,
    metadata: { clerkId },
  });

  if (!session.url) {
    throw new AppError(502, 'STRIPE_ERROR', 'Could not create checkout session');
  }
  return { url: session.url };
}

export async function getStatus(clerkId: string, role?: string): Promise<SubscriptionInfo> {
  const convex = getConvex();
  const data = await convex.query(getStatusData, {
    secret: internalSecret(),
    clerkId,
  });

  const effectiveRole = role ?? data.role;
  const sub = {
    status: data.status,
    tier: data.tier,
    currentPeriodEnd: data.currentPeriodEnd,
  };

  return {
    status: data.status,
    tier: data.tier,
    currentPeriodEnd: data.currentPeriodEnd
      ? new Date(data.currentPeriodEnd).toISOString()
      : null,
    entitled: isProEntitled(effectiveRole, sub, data.email),
    paperTradesUsed: data.paperTradesUsed,
    paperTradesLimit: FREE_PAPER_TRADE_LIMIT,
    canUsePaperTrading: canUsePaperTrading(effectiveRole, sub, data.paperTradesUsed),
  };
}
