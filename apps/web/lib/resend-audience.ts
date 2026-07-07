import { Resend } from 'resend';
import {
  findClerkIdByEmail,
  getResendContactId,
  setResendContactId,
} from '@/lib/db/users';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

function getAudienceId(): string | null {
  return process.env.RESEND_AUDIENCE_ID ?? null;
}

async function resolveClerkId(clerkId: string | undefined, email: string): Promise<string | null> {
  if (clerkId) return clerkId;
  return findClerkIdByEmail(email);
}

async function listContactByEmail(audienceId: string, email: string) {
  const resend = getResend();
  const listed = await resend.contacts.list({ audienceId });
  return listed.data?.data?.find((c) => c.email === email);
}

export async function syncResendContact(contact: {
  clerkId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
}) {
  const audienceId = getAudienceId();
  if (!audienceId) return;

  const resend = getResend();
  const clerkId = await resolveClerkId(contact.clerkId, contact.email);
  const storedId = clerkId ? await getResendContactId(clerkId) : null;

  if (storedId) {
    await resend.contacts.update({
      audienceId,
      id: storedId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed ?? false,
    });
    return;
  }

  try {
    const created = await resend.contacts.create({
      audienceId,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed ?? false,
    });
    const id = created.data?.id;
    if (clerkId && id) await setResendContactId(clerkId, id);
  } catch {
    const existing = await listContactByEmail(audienceId, contact.email);
    if (!existing) return;

    await resend.contacts.update({
      audienceId,
      id: existing.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed ?? false,
    });
    if (clerkId) await setResendContactId(clerkId, existing.id);
  }
}

export async function removeResendContact(email: string, clerkId?: string) {
  const audienceId = getAudienceId();
  if (!audienceId || !email) return;

  const resend = getResend();
  const resolvedClerkId = await resolveClerkId(clerkId, email);
  const storedId = resolvedClerkId ? await getResendContactId(resolvedClerkId) : null;
  const contactId = storedId ?? (await listContactByEmail(audienceId, email))?.id;
  if (!contactId) return;

  await resend.contacts.remove({ audienceId, id: contactId });
}

export async function unsubscribeResendContact(email: string, clerkId?: string) {
  const audienceId = getAudienceId();
  if (!audienceId) return;

  const resend = getResend();
  const resolvedClerkId = await resolveClerkId(clerkId, email);
  const storedId = resolvedClerkId ? await getResendContactId(resolvedClerkId) : null;
  const contact =
    storedId != null
      ? { id: storedId }
      : await listContactByEmail(audienceId, email);
  if (!contact?.id) return;

  await resend.contacts.update({
    audienceId,
    id: contact.id,
    unsubscribed: true,
  });
}

export async function syncWeeklyDigestPreference(
  email: string,
  enabled: boolean,
  clerkId?: string,
) {
  const audienceId = getAudienceId();
  if (!audienceId) return;

  const resend = getResend();
  const resolvedClerkId = await resolveClerkId(clerkId, email);
  const storedId = resolvedClerkId ? await getResendContactId(resolvedClerkId) : null;
  const contact =
    storedId != null
      ? { id: storedId }
      : await listContactByEmail(audienceId, email);
  if (!contact?.id) return;

  await resend.contacts.update({
    audienceId,
    id: contact.id,
    unsubscribed: !enabled,
  });
}
