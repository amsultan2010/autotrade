import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
