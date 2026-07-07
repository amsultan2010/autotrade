import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { syncAlpacaForClerk } from '@/lib/db/broker';

export async function POST() {
  try {
    const user = await requireUser();
    return ok(await syncAlpacaForClerk(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/broker/sync' });
  }
}
