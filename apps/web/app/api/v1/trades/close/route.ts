import { type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { closeAtMarket } from '@/lib/db/trades';
import { ok, handleError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { id } = (await req.json()) as { id: string };
    return ok(await closeAtMarket(user.clerkId, id));
  } catch (err) {
    return handleError(err, { route: '/api/v1/trades/close' });
  }
}
