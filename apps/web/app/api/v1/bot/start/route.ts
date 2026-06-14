import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma } from '@autotrade/engine';

export async function POST() {
  try {
    const user = await requireUser();
    const result = await prisma.botSettings.update({ where: { userId: user.id }, data: { mode: 'PAPER' } });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
