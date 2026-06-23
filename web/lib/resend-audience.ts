import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

function getAudienceId(): string | null {
  return process.env.RESEND_AUDIENCE_ID ?? null;
}

export async function syncResendContact(contact: {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
}) {
  const audienceId = getAudienceId();
  if (!audienceId) return; // no-op until audience is created

  try {
    await getResend().contacts.create({
      audienceId,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed ?? false,
    });
  } catch {
    // contact may already exist — ignore duplicate errors
  }
}

export async function removeResendContact(clerkUserId: string) {
  // Resend contacts are removed by email; we don't have it here at deletion time.
  // The user will be unsubscribed via Resend's own unsubscribe link instead.
  // Store a log or handle via a DB lookup if needed.
  void clerkUserId;
}

export async function unsubscribeResendContact(email: string) {
  const audienceId = getAudienceId();
  if (!audienceId) return;

  const resend = getResend();
  const contacts = await resend.contacts.list({ audienceId });
  const contact = contacts.data?.data?.find((c) => c.email === email);
  if (!contact) return;

  await resend.contacts.update({
    audienceId,
    id: contact.id,
    unsubscribed: true,
  });
}
