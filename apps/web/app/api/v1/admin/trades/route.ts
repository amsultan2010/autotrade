import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { listTrades } from '@/lib/db/admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { limit } = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await listTrades(limit));
  } catch (err) {
    return handleError(err);
  }
}
