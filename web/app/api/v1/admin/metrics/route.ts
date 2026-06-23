import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma } from '@autotrade/engine/public';

export async function GET() {
  try {
    await requireAdmin();
    const [users, activeSubs, openTrades, signals24h] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.trade.count({ where: { result: 'OPEN' } }),
      prisma.signal.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return ok({ users, activeSubs, openTrades, signals24h });
  } catch (err) {
    return handleError(err);
  }
}
