import { requireUser } from '@/lib/auth';
import { loadBrokerForSession } from '@/lib/broker-server';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    const broker = await loadBrokerForSession(user.clerkId);
    if (!broker) return ok([]);
    const data = await broker.getPositions();
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
