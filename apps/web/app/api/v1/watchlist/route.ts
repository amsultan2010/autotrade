import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { addToWatchlist, listWatchlist, removeFromWatchlist } from '@/lib/db/watchlist';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listWatchlist(user.clerkId));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = z.object({
      symbol: z.string(),
      exchange: z.string(),
      mic: z.string().optional(),
    }).parse(await req.json());
    const id = await addToWatchlist(user.clerkId, body);
    return ok({ id });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new Error('Missing id');
    await removeFromWatchlist(user.clerkId, id);
    return ok({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
