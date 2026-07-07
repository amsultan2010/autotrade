import { type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listClosedTrades } from '@/lib/db/trades';
import { ok, handleError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const limit = Number(new URL(req.url).searchParams.get('limit') ?? '200');
    return ok(await listClosedTrades(user.clerkId, limit));
  } catch (err) {
    return handleError(err, { route: '/api/v1/trades/closed' });
  }
}
