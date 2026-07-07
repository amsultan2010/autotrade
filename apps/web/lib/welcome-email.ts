import { claimWelcomeEmail } from '@/lib/db/users';
import { sendWelcomeEmail } from '@/lib/email';
import { syncResendContact } from '@/lib/resend-audience';

/** Idempotent welcome email — claims send slot in Supabase before dispatching. */
export async function deliverWelcomeEmail(params: {
  clerkId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const claimed = await claimWelcomeEmail(params.clerkId);

  if (!claimed) {
    return { sent: false, reason: 'already_sent' };
  }

  await Promise.allSettled([
    sendWelcomeEmail(params.email, params.name),
    syncResendContact({
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
    }),
  ]);

  return { sent: true };
}
