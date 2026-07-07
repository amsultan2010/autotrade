import { requireUser } from '@/lib/auth';
import { brokerStatus } from '@/lib/db/broker';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await brokerStatus(user.clerkId));
  } catch (err) {
    return handleError(err, { route: '/api/v1/broker/status' });
  }
}
