'use node';
// HTTP endpoints for inbound webhooks.
// Must be 'use node' because svix and stripe use Node.js APIs.

import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { Webhook } from 'svix';
import Stripe from 'stripe';

const http = httpRouter();

// ── Clerk webhook ─────────────────────────────────────────────────────────────
// Route: POST /webhooks/clerk
// Set this URL in the Clerk dashboard → Webhooks.
// Events to subscribe: user.created, user.deleted

type EmailAddress = { id: string; email_address: string };
type ClerkEvent =
  | {
      type: 'user.created';
      data: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        primary_email_address_id: string | null;
        email_addresses: EmailAddress[];
      };
    }
  | { type: 'user.deleted'; data: { id: string; deleted: boolean } };

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      return new Response('CLERK_WEBHOOK_SECRET not configured', { status: 500 });
    }

    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 });
    }

    const payload = await request.text();
    const wh = new Webhook(secret);

    let event: ClerkEvent;
    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkEvent;
    } catch {
      return new Response('Invalid signature', { status: 400 });
    }

    if (event.type === 'user.created') {
      const primaryEmail = event.data.email_addresses.find(
        (e) => e.id === event.data.primary_email_address_id,
      )?.email_address;

      if (primaryEmail) {
        await ctx.runMutation(internal.users.syncFromClerk, {
          clerkId: event.data.id,
          email: primaryEmail,
        });
      }
    }

    if (event.type === 'user.deleted') {
      await ctx.runMutation(internal.users.disableFromClerk, {
        clerkId: event.data.id,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// ── Stripe webhook ────────────────────────────────────────────────────────────
// Route: POST /webhooks/stripe
// Set this URL in the Stripe dashboard → Developers → Webhooks.
// Events to subscribe: customer.subscription.created, customer.subscription.updated,
//                      customer.subscription.deleted, checkout.session.completed

http.route({
  path: '/webhooks/stripe',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecret || !webhookSecret) {
      return new Response('Stripe env vars not configured', { status: 500 });
    }

    const stripe = new Stripe(stripeSecret);
    const sig = request.headers.get('stripe-signature');
    if (!sig) return new Response('Missing stripe-signature', { status: 400 });

    const payload = await request.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(payload, sig, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Webhook signature verification failed';
      return new Response(msg, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.metadata?.clerkId;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        if (clerkId && customerId) {
          await ctx.runMutation(internal.subscription.linkStripeCustomer, {
            clerkId,
            stripeCustomerId: customerId,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? '';
        const item = sub.items.data[0];
        await ctx.runMutation(internal.subscription.syncFromStripe, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          tier: item?.price?.nickname ?? item?.price?.lookup_key ?? undefined,
          status: mapStripeStatus(sub.status),
          currentPeriodEnd: (sub as { current_period_end?: number }).current_period_end
            ? ((sub as { current_period_end: number }).current_period_end * 1000)
            : undefined,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? '';
        await ctx.runMutation(internal.subscription.syncFromStripe, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          status: 'CANCELED',
        });
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

function mapStripeStatus(
  status: Stripe.Subscription.Status,
): 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    case 'trialing':
      return 'TRIALING';
    default:
      return 'NONE';
  }
}

export default http;
