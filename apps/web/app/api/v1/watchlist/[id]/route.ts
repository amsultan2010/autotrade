import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, NotFoundError } from '@autotrade/engine';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const found = await prisma.watchedSymbol.findFirst({ where: { id, userId: user.id } });
    if (!found) throw new NotFoundError('Symbol not in your watchlist');
    await prisma.watchedSymbol.delete({ where: { id } });
    return ok(null, 204);
  } catch (err) {
    return handleError(err);
  }
}
