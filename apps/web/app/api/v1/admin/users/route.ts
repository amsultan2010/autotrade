import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { listUsers } from '@/lib/db/admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { q, limit } = parse(
      z.object({ q: z.string().max(255).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await listUsers({ q, limit }));
  } catch (err) {
    return handleError(err);
  }
}
