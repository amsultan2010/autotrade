import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';
import { syncResendContact, removeResendContact } from '@/lib/resend-audience';
// TODO (after `npx convex dev`): import { convexServer } from '@/lib/convex-server';
// TODO (after `npx convex dev`): import { internal } from '@/convex/_generated/api';
// Then add to user.created: convexServer.mutation(internal.users.syncFromClerk, { clerkId: data.id, email: primaryEmail })
// Then add to user.deleted: convexServer.mutation(internal.users.disableFromClerk, { clerkId: event.data.id })

type EmailAddress = { id: string; email_address: string };

type ClerkUserCreatedEvent = {
  type: 'user.created';
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

type ClerkEvent = ClerkUserCreatedEvent | ClerkUserDeletedEvent;

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
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'user.created') {
    const { data } = event;
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    )?.email_address;

    if (primaryEmail) {
      const firstName = data.first_name ?? '';
      const lastName = data.last_name ?? '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Trader';

      await Promise.allSettled([
        sendWelcomeEmail(primaryEmail, name),
        syncResendContact({ email: primaryEmail, firstName, lastName }),
      ]);
    }
  }

  if (event.type === 'user.deleted') {
    // no email to remove from — handled via Resend unsubscribe only
    void removeResendContact(event.data.id);
  }

  return NextResponse.json({ received: true });
}
