/**
 * Subscription service. Stripe drives state changes via webhooks; Supabase is the
 * source of truth for entitlement. Webhook handling lives in the Next.js route.
 */
import {
  normalizePlanTier,
  trialEligibleTier,
  TRIAL_PERIOD_DAYS,
  type PlanTier,
} from '@autotrade/shared';
import { env } from '../config/env';
import { getStripe } from '../lib/stripe';
import { AppError } from '../lib/errors';
import { canUsePaperTrading, isProEntitled } from '../middleware/subscription';
import { FREE_PAPER_TRADE_LIMIT } from '@autotrade/shared';
import type { SubscriptionInfo, SubscriptionStatus } from '@autotrade/shared';
import {
  getCheckoutData,
  getStatusData,
  setLegacyTier,
  setStripeCustomerId,
} from '../lib/subscription-db';

function useLaunchPrices(): boolean {
  return process.env.STRIPE_USE_LAUNCH_PRICES !== 'false';
}

function stripePriceIdForTier(tier: PlanTier): string {
  const useLaunch = useLaunchPrices();
  let id: string | undefined;
  switch (tier) {
    case 'essential':
      id = env.STRIPE_PRICE_ESSENTIAL ?? env.STRIPE_PRICE_STARTER;
      break;
    case 'pro':
      id = useLaunch
        ? (env.STRIPE_PRICE_PRO_LAUNCH ?? env.STRIPE_PRICE_PRO)
        : env.STRIPE_PRICE_PRO;
      break;
    case 'unlimited':
      id = useLaunch
        ? (env.STRIPE_PRICE_UNLIMITED_LAUNCH ?? env.STRIPE_PRICE_UNLIMITED ?? env.STRIPE_PRICE_ELITE)
        : (env.STRIPE_PRICE_UNLIMITED ?? env.STRIPE_PRICE_ELITE);
      break;
  }
  if (!id) {
    throw new AppError(503, 'BILLING_UNCONFIGURED', `No Stripe price configured for tier: ${tier}`);
  }
  return id;
}

function tierRank(tier: PlanTier | null): number {
  switch (tier) {
    case 'essential':
      return 1;
    case 'pro':
      return 2;
    case 'unlimited':
      return 3;
    default:
      return 0;
  }
}

async function ensureStripeCustomer(
  stripe: ReturnType<typeof getStripe>,
  clerkId: string,
  email: string,
): Promise<string> {
  const checkout = await getCheckoutData(clerkId);
  if (checkout.stripeCustomerId) return checkout.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { clerkId },
  });
  await setStripeCustomerId(clerkId, customer.id);
  return customer.id;
}

export async function createCheckoutSession(
  clerkId: string,
  email: string,
  tier: PlanTier,
): Promise<{ url: string }> {
  if (!env.BILLING_ENABLED) {
    throw new AppError(503, 'BILLING_DISABLED', 'Billing is not enabled');
  }

  const stripe = getStripe();
  const priceId = stripePriceIdForTier(tier);
  const checkout = await getCheckoutData(clerkId);
  const customerId = await ensureStripeCustomer(stripe, clerkId, email);

  if (
    checkout.stripeSubscriptionId &&
    (checkout.status === 'ACTIVE' || checkout.status === 'TRIALING')
  ) {
    return changeSubscription(clerkId, tier);
  }

  const eligible = trialEligibleTier(checkout.effectiveTier);
  const canTrial = eligible === tier && !checkout.trialsUsed.includes(tier);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: env.CHECKOUT_SUCCESS_URL,
    cancel_url: env.CHECKOUT_CANCEL_URL,
    client_reference_id: clerkId,
    metadata: { clerkId, tier },
    subscription_data: {
      metadata: { clerkId, tier },
      ...(canTrial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
    },
  });

  if (!session.url) {
    throw new AppError(502, 'STRIPE_ERROR', 'Could not create checkout session');
  }
  return { url: session.url };
}

export async function changeSubscription(
  clerkId: string,
  tier: PlanTier,
): Promise<{ url: string }> {
  if (!env.BILLING_ENABLED) {
    throw new AppError(503, 'BILLING_DISABLED', 'Billing is not enabled');
  }

  const stripe = getStripe();
  const checkout = await getCheckoutData(clerkId);

  if (!checkout.stripeSubscriptionId) {
    throw new AppError(400, 'NO_SUBSCRIPTION', 'No active subscription to change');
  }

  const priceId = stripePriceIdForTier(tier);
  const subscription = await stripe.subscriptions.retrieve(checkout.stripeSubscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    throw new AppError(502, 'STRIPE_ERROR', 'Subscription has no line items');
  }

  const currentTier = normalizePlanTier(checkout.tier);
  const isDowngrade = tierRank(currentTier) > tierRank(tier);
  const periodEndMs = subscription.current_period_end * 1000;

  if (isDowngrade && currentTier) {
    await setLegacyTier(clerkId, currentTier, periodEndMs);
  }

  await stripe.subscriptions.update(checkout.stripeSubscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: isDowngrade ? 'none' : 'create_prorations',
    cancel_at_period_end: false,
    metadata: { clerkId, tier },
  });

  return { url: env.CHECKOUT_SUCCESS_URL };
}

export async function cancelSubscription(clerkId: string): Promise<{ ok: true }> {
  if (!env.BILLING_ENABLED) {
    throw new AppError(503, 'BILLING_DISABLED', 'Billing is not enabled');
  }

  const stripe = getStripe();
  const checkout = await getCheckoutData(clerkId);

  if (!checkout.stripeSubscriptionId) {
    throw new AppError(400, 'NO_SUBSCRIPTION', 'No active subscription to cancel');
  }

  await stripe.subscriptions.cancel(checkout.stripeSubscriptionId);
  return { ok: true };
}

export async function reactivateSubscription(clerkId: string): Promise<{ ok: true }> {
  if (!env.BILLING_ENABLED) {
    throw new AppError(503, 'BILLING_DISABLED', 'Billing is not enabled');
  }

  const stripe = getStripe();
  const checkout = await getCheckoutData(clerkId);

  if (!checkout.stripeSubscriptionId) {
    throw new AppError(400, 'NO_SUBSCRIPTION', 'No subscription to reactivate');
  }

  await stripe.subscriptions.update(checkout.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return { ok: true };
}

export async function getStatus(clerkId: string, role?: string): Promise<SubscriptionInfo> {
  const data = await getStatusData(clerkId);
  const effectiveRole = role ?? data.role;
  const sub = {
    status: data.status,
    tier: data.tier,
    currentPeriodEnd: data.currentPeriodEnd,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    legacyTier: data.legacyTier,
    legacyTierUntil: data.legacyTierUntil,
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
    canUsePaperTrading: canUsePaperTrading(effectiveRole, sub, data.paperTradesUsed, data.email),
  };
}
