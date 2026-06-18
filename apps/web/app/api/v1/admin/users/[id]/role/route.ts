import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { ROLES } from '@autotrade/shared';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse, writeAudit } from '@autotrade/engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const { role } = parse(z.object({ role: z.enum(ROLES) }), await req.json() as unknown);
    const updated = await prisma.user.update({ where: { id }, data: { role } });
    await writeAudit({ actorId: actor.id, action: 'USER_ROLE_CHANGE', target: id, meta: { role } });
    return ok({ id: updated.id, role: updated.role });
  } catch (err) {
    return handleError(err);
  }
}
