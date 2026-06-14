import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse } from '@autotrade/engine';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), Object.fromEntries(new URL(req.url).searchParams));
    return ok(await prisma.signal.findMany({ take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true } } } }));
  } catch (err) {
    return handleError(err);
  }
}
