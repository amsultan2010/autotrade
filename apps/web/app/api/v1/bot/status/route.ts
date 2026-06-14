import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma } from '@autotrade/engine';

export async function GET() {
  try {
    const user = await requireUser();
    const [settings, paper, openTrades] = await Promise.all([
      prisma.botSettings.findUnique({ where: { userId: user.id } }),
      prisma.paperAccount.findUnique({ where: { userId: user.id } }),
      prisma.trade.count({ where: { userId: user.id, result: 'OPEN' } }),
    ]);
    return ok({
      mode: settings?.mode ?? 'DISABLED',
      running: settings?.mode === 'PAPER',
      openTrades,
      paperAccount: paper,
    });
  } catch (err) {
    return handleError(err);
  }
}
