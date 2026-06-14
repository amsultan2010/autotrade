import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getStatus } from '@autotrade/engine';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getStatus(user.id, user.role));
  } catch (err) {
    return handleError(err);
  }
}
