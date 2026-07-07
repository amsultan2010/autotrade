import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { cashOutWinners } from '@/lib/db/trades';

export async function POST() {
  try {
    const user = await requireUser();
    return ok(await cashOutWinners(user.clerkId));
  } catch (err) {
    return handleError(err);
  }
}
