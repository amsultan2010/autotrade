import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma } from '@autotrade/engine';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return ok(await prisma.trade.findFirst({ where: { id, userId: user.id }, include: { signal: true } }));
  } catch (err) {
    return handleError(err);
  }
}
