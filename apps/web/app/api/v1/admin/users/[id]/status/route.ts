import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { USER_STATUSES } from '@autotrade/shared';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse, writeAudit } from '@autotrade/engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const { status } = parse(z.object({ status: z.enum(USER_STATUSES) }), await req.json() as unknown);
    const updated = await prisma.user.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: actor.id, action: 'USER_STATUS_CHANGE', target: id, meta: { status } });
    if (status === 'DISABLED') {
      await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return ok({ id: updated.id, status: updated.status });
  } catch (err) {
    return handleError(err);
  }
}
