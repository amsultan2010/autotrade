import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { performanceSummary } from '@/lib/db/trades';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await performanceSummary(user.clerkId));
  } catch (err) {
    return handleError(err);
  }
}
