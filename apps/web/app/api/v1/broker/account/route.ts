import { requireUser } from '@/lib/auth';
import { loadBrokerForSession } from '@/lib/broker-server';
import { ok, handleError } from '@/lib/api-response';

export async function GET() {
  try {
    const user = await requireUser();
    const broker = await loadBrokerForSession(user.clerkId);
    if (!broker) return ok(null);
    const data = await broker.getAccount();
    return ok({ ...data, mode: broker.mode });
  } catch (err) {
    return handleError(err);
  }
}
