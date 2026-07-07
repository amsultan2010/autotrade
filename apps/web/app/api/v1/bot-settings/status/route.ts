import { requireUser } from '@/lib/auth';
import { getBotStatus } from '@/lib/db/botSettings';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getBotStatus(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/bot-settings/status' });
  }
}
