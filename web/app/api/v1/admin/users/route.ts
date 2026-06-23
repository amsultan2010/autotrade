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
    const { q, limit } = parse(
      z.object({ q: z.string().max(255).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await fetchQuery(api.admin.listUsers, { q, limit }, { token }));
  } catch (err) {
    return handleError(err);
  }
}
