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
  if (!audienceId) return;

  const resend = getResend();

  try {
    await resend.contacts.create({
      audienceId,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed ?? false,
    });
  } catch {
    const listed = await resend.contacts.list({ audienceId });
    const existing = listed.data?.data?.find((c) => c.email === contact.email);
    if (!existing) return;

    await resend.contacts.update({
      audienceId,
      id: existing.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed ?? false,
    });
  }
}

export async function removeResendContact(clerkUserId: string) {
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

export async function syncWeeklyDigestPreference(email: string, enabled: boolean) {
  const audienceId = getAudienceId();
  if (!audienceId) return;

  const resend = getResend();
  const contacts = await resend.contacts.list({ audienceId });
  const contact = contacts.data?.data?.find((c) => c.email === email);
  if (!contact) return;

  await resend.contacts.update({
    audienceId,
    id: contact.id,
    unsubscribed: !enabled,
  });
}
