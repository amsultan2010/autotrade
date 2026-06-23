import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, NotFoundError } from '@autotrade/engine/public';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, status: true, createdAt: true, subscription: true, botSettings: true, paperAccount: true, _count: { select: { trades: true, signals: true } } },
    });
    if (!user) throw new NotFoundError('User not found');
    return ok(user);
  } catch (err) {
    return handleError(err);
  }
}
