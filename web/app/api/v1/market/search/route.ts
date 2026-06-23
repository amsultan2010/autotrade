import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { marketDataForUser } from '@/lib/market-data-server';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { q } = parse(z.object({ q: z.string().min(1).max(50) }), Object.fromEntries(new URL(req.url).searchParams));
    const md = await marketDataForUser(user.clerkId);
    return ok(await md.searchSymbols(q));
  } catch (err) {
    return handleError(err);
  }
}
