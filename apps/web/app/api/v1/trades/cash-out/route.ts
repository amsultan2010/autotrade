import { requireUser } from '@/lib/auth';
import { cashOutWinners } from '@/lib/db/trades';
import { ok, handleError } from '@/lib/api-response';

export async function POST() {
  try {
    const user = await requireUser();
    return ok(await cashOutWinners(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/trades/cash-out' });
  }
}
