import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getSubscriptionInfo } from '@/lib/db/subscriptions';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getSubscriptionInfo(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/subscription' });
  }
}
