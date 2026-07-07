import { type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { setBotMode } from '@/lib/db/botSettings';
import { ok, handleError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { mode } = (await req.json()) as { mode: 'DISABLED' | 'PAPER' | 'LIVE' };
    return ok(await setBotMode(user.clerkId, mode));
  } catch (err) {
    return handleError(err, { route: '/api/v1/bot-settings/mode' });
  }
}
