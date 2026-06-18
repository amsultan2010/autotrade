/**
 * Subscription service. The backend is the single source of truth for
 * entitlement (req #2, #6). Stripe drives state changes via webhooks; we never
 * trust the client's claim about its own subscription.
 */
import type Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { getStripe } from '../lib/stripe';
import { AppError, BadRequestError } from '../lib/errors';
import { isEntitled } from '../middleware/subscription';
import type { SubscriptionInfo, SubscriptionStatus } from '@autotrade/shared';

/** Map Stripe subscription status → our enum. */
function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'CANCELED';
    default:
      return 'NONE';
  }
}

/** Create (or reuse) a Stripe customer for a user, then a Checkout Session. */
export async function createCheckoutSession(userId: string, email: string): Promise<{ url: string }> {
  if (!env.STRIPE_PRICE_ID) {
    throw new AppError(503, 'BILLING_UNCONFIGURED', 'No price configured');
  }
  const stripe = getStripe();

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId },
      update: { stripeCustomerId: customerId },
      create: { userId, stripeCustomerId: customerId, status: 'NONE' },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: env.CHECKOUT_SUCCESS_URL,
    cancel_url: env.CHECKOUT_CANCEL_URL,
    client_reference_id: userId,
    metadata: { userId },
  });

  if (!session.url) throw new AppError(502, 'STRIPE_ERROR', 'Could not create checkout session');
  return { url: session.url };
}

/** Verify the webhook signature and apply the resulting state change. */
export async function handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError(503, 'BILLING_UNCONFIGURED', 'No webhook secret');
  if (!signature) throw new BadRequestError('Missing Stripe-Signature header');

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw new BadRequestError(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (userId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertFromStripe(userId, customerId ?? null, subscription);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      // Resolve user by stored customer id.
      const existing = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
      const userId = existing?.userId ?? (subscription.metadata?.userId as string | undefined);
      if (userId) await upsertFromStripe(userId, customerId, subscription);
      break;
    }
    default:
      // Ignore unrelated events.
      break;
  }
}

async function upsertFromStripe(
  userId: string,
  customerId: string | null,
  subscription: Stripe.Subscription,
): Promise<void> {
  const status = mapStatus(subscription.status);
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const tier = subscription.items.data[0]?.price.lookup_key ?? 'pro';

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      status,
      tier,
      currentPeriodEnd: periodEnd,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status,
      tier,
      currentPeriodEnd: periodEnd,
    },
  });
}

export async function getStatus(userId: string, role: string): Promise<SubscriptionInfo> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, tier: true, currentPeriodEnd: true },
  });
  return {
    status: sub?.status ?? 'NONE',
    tier: sub?.tier ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    entitled: isEntitled(role, sub ?? null),
  };
}
