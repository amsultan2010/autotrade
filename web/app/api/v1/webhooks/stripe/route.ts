import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { ErrorCodes } from '@autotrade/shared';
import { env, getStripe, BadRequestError } from '@autotrade/engine/public';
import { captureAppErrorServer } from '@/lib/error-tracking-server';
import { convexServer } from '@/lib/convex-server';
import { makeFunctionReference } from 'convex/server';

type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';

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

function internalSecret(): string {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) throw new Error('BOT_INTERNAL_SECRET not configured');
  return secret;
}

const upsertFromStripe = makeFunctionReference<
  'mutation',
  {
    secret: string;
    clerkId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    tier?: string;
    status: SubscriptionStatus;
    currentPeriodEnd?: number;
  },
  string
>('subscriptionInternal:upsertFromStripe');

const getByStripeCustomerId = makeFunctionReference<
  'query',
  { secret: string; stripeCustomerId: string },
  { clerkId: string } | null
>('subscriptionInternal:getByStripeCustomerId');

async function applyStripeSubscription(
  clerkId: string,
  customerId: string | null,
  subscription: Stripe.Subscription,
): Promise<void> {
  const status = mapStatus(subscription.status);
  const periodEnd = subscription.current_period_end
    ? subscription.current_period_end * 1000
    : undefined;
  const tier = subscription.items.data[0]?.price.lookup_key ?? 'pro';

  await convexServer.mutation(upsertFromStripe, {
    secret: internalSecret(),
    clerkId,
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscription.id,
    tier,
    status,
    currentPeriodEnd: periodEnd,
  });
}

export async function POST(req: Request) {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json({ error: 'Billing is not enabled' }, { status: 503 });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 });
  }

  const headerList = await headers();
  const signature = headerList.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
  }

  const payload = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    captureAppErrorServer(ErrorCodes.STRIPE_ERROR, err, {
      route: '/api/v1/webhooks/stripe',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId =
          session.metadata?.clerkId ??
          session.metadata?.userId ??
          session.client_reference_id ??
          undefined;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (clerkId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await applyStripeSubscription(clerkId, customerId ?? null, subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const existing = await convexServer.query(getByStripeCustomerId, {
          secret: internalSecret(),
          stripeCustomerId: customerId,
        });

        const clerkId =
          existing?.clerkId ??
          (subscription.metadata?.clerkId as string | undefined) ??
          (subscription.metadata?.userId as string | undefined);

        if (clerkId) {
          await applyStripeSubscription(clerkId, customerId, subscription);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    if (err instanceof BadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    captureAppErrorServer(ErrorCodes.SUBSCRIPTION, err, {
      route: '/api/v1/webhooks/stripe',
      eventType: event.type,
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
