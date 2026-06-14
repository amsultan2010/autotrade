import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { createCheckoutSession } from '@autotrade/engine';

export async function POST() {
  try {
    const user = await requireUser();
    return ok(await createCheckoutSession(user.id, user.email));
  } catch (err) {
    return handleError(err);
  }
}
