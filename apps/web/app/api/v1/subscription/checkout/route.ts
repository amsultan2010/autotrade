import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { capture } from '@/lib/analytics';
import { createCheckoutSession } from '@autotrade/engine';

export async function POST() {
  try {
    const user = await requireUser();
    capture(user.id, { event: 'subscription_checkout_started', properties: { userId: user.id } });
    return ok(await createCheckoutSession(user.id, user.email));
  } catch (err) {
    return handleError(err);
  }
}
