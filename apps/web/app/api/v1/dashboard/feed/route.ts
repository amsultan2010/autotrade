import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getDashboardFeed } from '@/lib/db/dashboard';
import { parse } from '@autotrade/engine/public';

const querySchema = z.object({
  signalsLimit: z.coerce.number().int().min(1).max(100).default(12),
  tradesLimit: z.coerce.number().int().min(1).max(500).default(200),
  openLimit: z.coerce.number().int().min(1).max(200).default(100),
  closedLimit: z.coerce.number().int().min(1).max(500).default(200),
});

/** Consolidated dashboard payload — one poll instead of ~10 separate API calls. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const params = parse(querySchema, Object.fromEntries(new URL(req.url).searchParams));
    return ok(await getDashboardFeed(user.clerkId, params));
  } catch (err) {
    return handleError(err, { route: '/api/v1/dashboard/feed' });
  }
}
