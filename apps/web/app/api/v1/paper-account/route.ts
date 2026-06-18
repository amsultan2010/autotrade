import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma } from '@autotrade/engine';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await prisma.paperAccount.findUnique({ where: { userId: user.id } }));
  } catch (err) {
    return handleError(err);
  }
}
