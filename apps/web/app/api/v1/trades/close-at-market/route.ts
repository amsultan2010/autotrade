import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { closeAtMarket } from '@/lib/db/trades';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { id } = z.object({ id: z.string() }).parse(await req.json());
    return ok(await closeAtMarket(user.clerkId, id));
  } catch (err) {
    return handleError(err);
  }
}
