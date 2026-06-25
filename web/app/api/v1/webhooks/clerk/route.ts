import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ErrorCodes } from '@autotrade/shared';
import { captureAppErrorServer } from '@/lib/error-tracking-server';
import { deliverWelcomeEmail } from '@/lib/welcome-email';
import { syncResendContact, unsubscribeResendContact } from '@/lib/resend-audience';
import { identifyUser } from '@/lib/analytics';
import { convexServer } from '@/lib/convex-server';
import { api as convexApi } from '@/convex/_generated/api';

type EmailAddress = { id: string; email_address: string };

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated';
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    primary_email_address_id: string | null;
    email_addresses: EmailAddress[];
  };
};

type ClerkUserDeletedEvent = {
  type: 'user.deleted';
  data: { id: string; deleted: boolean };
};

type ClerkEvent = ClerkUserEvent | ClerkUserDeletedEvent;

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CLERK_WEBHOOK_SECRET not configured' }, { status: 500 });
  }

  const headerList = await headers();
  const svixId = headerList.get('svix-id');
  const svixTimestamp = headerList.get('svix-timestamp');
  const svixSignature = headerList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: ClerkEvent;
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    captureAppErrorServer(ErrorCodes.CLERK_WEBHOOK_VERIFY, err, {
      route: '/api/v1/webhooks/clerk',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { data } = event;
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    )?.email_address;

    if (primaryEmail) {
      const firstName = data.first_name ?? '';
      const lastName = data.last_name ?? '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Trader';

      identifyUser(data.id, { email: primaryEmail, name });

      if (event.type === 'user.created') {
        const syncResult = await convexServer.mutation(convexApi.users.syncFromClerk, {
          clerkId: data.id,
          email: primaryEmail,
        });

        if (syncResult.shouldSendWelcome) {
          await deliverWelcomeEmail({
            clerkId: data.id,
            email: primaryEmail,
            name,
            firstName,
            lastName,
          });
        } else {
          await syncResendContact({ email: primaryEmail, firstName, lastName });
        }
      } else {
        await Promise.allSettled([
          syncResendContact({ email: primaryEmail, firstName, lastName }),
          convexServer.mutation(convexApi.users.syncFromClerk, { clerkId: data.id, email: primaryEmail }),
        ]);
      }
    }
  }

  if (event.type === 'user.deleted') {
    // Disable in Convex first — mutation returns the user's email so we can
    // unsubscribe them from Resend without a separate lookup.
    const email = await convexServer.mutation(convexApi.users.disableFromClerk, {
      clerkId: event.data.id,
    });
    if (email) {
      void unsubscribeResendContact(email);
    }
  }

  return NextResponse.json({ received: true });
}
