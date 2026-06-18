import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { closeTradeAtMarket, BadRequestError, prisma } from '@autotrade/engine';
import { capture } from '@/lib/analytics';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await closeTradeAtMarket(id, user.id);
    if (!result.closed) throw new BadRequestError(result.reason ?? 'Could not close trade');

    const trade = await prisma.trade.findUnique({ where: { id }, select: { symbol: true, pnl: true, mode: true } });
    if (trade) {
      capture(user.id, {
        event: 'trade_closed',
        properties: { userId: user.id, symbol: trade.symbol, pnl: trade.pnl ?? 0, mode: trade.mode },
      });
    }

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
