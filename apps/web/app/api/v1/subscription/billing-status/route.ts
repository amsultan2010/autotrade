import { requireUser } from '@/lib/auth';
import { getSubscriptionByClerkId } from '@/lib/db/subscriptions';
import { me } from '@/lib/db/users';
import { isBillingEnabled } from '@/lib/billing';
import { isLiveEntitled } from '@/lib/entitlements';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await me(user.clerkId);
    const sub = await getSubscriptionByClerkId(user.clerkId);
    return ok({
      billingEnabled: isBillingEnabled(),
      liveEntitled: isLiveEntitled(
        profile?.role ?? 'USER',
        sub,
        profile?.email,
        profile?.founderPlanOverride ?? null,
      ),
    });
  } catch (err) {
    return handleError(err, { route: '/api/v1/subscription/billing-status' });
  }
}
