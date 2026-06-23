import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse } from '@autotrade/engine/public';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { q, limit } = parse(
      z.object({ q: z.string().max(255).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return ok(await prisma.user.findMany({
      where: q ? { email: { contains: q, mode: 'insensitive' } } : undefined,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, status: true, createdAt: true, subscription: { select: { status: true, tier: true, currentPeriodEnd: true } }, _count: { select: { trades: true } } },
    }));
  } catch (err) {
    return handleError(err);
  }
}
