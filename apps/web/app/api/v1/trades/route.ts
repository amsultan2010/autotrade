import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { listTrades } from '@/lib/db/trades';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const query = z.object({
      result: z.enum(['OPEN', 'WIN', 'LOSS', 'BREAKEVEN']).optional(),
      mode: z.enum(['DISABLED', 'PAPER', 'LIVE']).optional(),
      symbol: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
      cursor: z.string().optional(),
    }).parse(params);
    return ok(await listTrades(user.clerkId, query));
  } catch (err) {
    return handleError(err);
  }
}
