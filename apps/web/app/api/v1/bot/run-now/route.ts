import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { runCycleForUser } from '@autotrade/engine';

export async function POST() {
  try {
    const user = await requireUser();
    await runCycleForUser(user.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
