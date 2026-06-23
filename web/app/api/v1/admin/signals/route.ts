import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { convexToken } from '@/lib/convex-auth-token';
import { parse } from '@autotrade/engine/public';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const token = await convexToken();
    const { limit } = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await fetchQuery(api.admin.listSignals, { limit }, { token }));
  } catch (err) {
    return handleError(err);
  }
}
