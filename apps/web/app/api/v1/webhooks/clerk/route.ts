import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ErrorCodes } from '@autotrade/shared';
import { captureAppErrorServer } from '@/lib/error-tracking-server';
import { deliverWelcomeEmail } from '@/lib/welcome-email';
import { syncResendContact, unsubscribeResendContact } from '@/lib/resend-audience';
import { identifyUser, capture } from '@/lib/analytics';
import { disableFromClerk, syncFromClerk } from '@/lib/db/users';

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
        capture(data.id, { event: 'user_signed_up', properties: { userId: data.id, email: primaryEmail } });
        try {
          const syncResult = await syncFromClerk({ clerkId: data.id, email: primaryEmail });

          if (syncResult.shouldSendWelcome) {
            await deliverWelcomeEmail({
              clerkId: data.id,
              email: primaryEmail,
              name,
              firstName,
              lastName,
            });
          } else {
            await syncResendContact({
              clerkId: data.id,
              email: primaryEmail,
              firstName,
              lastName,
            });
          }
        } catch (err) {
          captureAppErrorServer(ErrorCodes.BOT_USER_CREATE, err, {
            route: '/api/v1/webhooks/clerk',
            userId: data.id,
            phase: 'user.created',
          });
          throw err;
        }
      } else {
        await Promise.allSettled([
          syncResendContact({
            clerkId: data.id,
            email: primaryEmail,
            firstName,
            lastName,
          }),
          syncFromClerk({ clerkId: data.id, email: primaryEmail }).catch((err) => {
            captureAppErrorServer(ErrorCodes.BOT_USER_CREATE, err, {
              route: '/api/v1/webhooks/clerk',
              userId: data.id,
              phase: 'user.updated',
            });
            throw err;
          }),
        ]);
      }
    }
  }

  if (event.type === 'user.deleted') {
    const email = await disableFromClerk(event.data.id);
    if (email) {
      void unsubscribeResendContact(email, event.data.id);
    }
  }

  return NextResponse.json({ received: true });
}
