import { requireUser } from '@/lib/auth';
import { ensureExists } from '@/lib/db/users';
import { ok, handleError } from '@/lib/api-response';

export async function POST() {
  try {
    const user = await requireUser();
    const { shouldSendWelcome } = await ensureExists(user.clerkId, user.email);
    return ok({ user, shouldSendWelcome });
  } catch (err) {
    return handleError(err, { route: '/api/v1/auth/clerk-sync' });
  }
}
