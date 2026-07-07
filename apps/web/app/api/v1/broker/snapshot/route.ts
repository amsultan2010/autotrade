import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { brokerStatus, getSnapshot, syncAlpacaForClerk } from '@/lib/db/broker';

export async function GET() {
  try {
    const user = await requireUser();
    let snap = await getSnapshot(user.clerkId);

    if (!snap) {
      const status = await brokerStatus(user.clerkId);
      if (status.connected) {
        await syncAlpacaForClerk(user.clerkId, { force: true });
        snap = await getSnapshot(user.clerkId);
      }
    }

    return ok(snap);
  } catch (err) {
    return handleError(err, { route: '/api/v1/broker/snapshot' });
  }
}
