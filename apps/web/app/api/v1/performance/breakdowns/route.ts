import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { computeBreakdowns } from '@autotrade/engine';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await computeBreakdowns(user.id));
  } catch (err) {
    return handleError(err);
  }
}
