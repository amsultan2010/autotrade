import { convexServer } from '@/lib/convex-server';
import { api as convexApi } from '@/convex/_generated/api';
import { sendWelcomeEmail } from '@/lib/email';
import { syncResendContact } from '@/lib/resend-audience';

/** Idempotent welcome email — claims send slot in Convex before dispatching. */
export async function deliverWelcomeEmail(params: {
  clerkId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const claimed = await convexServer.mutation(convexApi.users.claimWelcomeEmail, {
    clerkId: params.clerkId,
  });

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
