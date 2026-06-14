import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma } from '@autotrade/engine';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await prisma.signal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }));
  } catch (err) {
    return handleError(err);
  }
}
