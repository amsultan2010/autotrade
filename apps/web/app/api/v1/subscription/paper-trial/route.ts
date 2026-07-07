import { requireUser } from '@/lib/auth';
import { getSubscriptionInfo } from '@/lib/db/subscriptions';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    const info = await getSubscriptionInfo(user.clerkId);
    return ok({ paperTradesUsed: info.paperTradesUsed, canUsePaperTrading: info.canUsePaperTrading });
  } catch (err) {
    return handleError(err, { route: '/api/v1/subscription/paper-trial' });
  }
}
