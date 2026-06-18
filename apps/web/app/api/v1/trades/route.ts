import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { TRADE_RESULTS, EXECUTION_MODES } from '@autotrade/shared';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse } from '@autotrade/engine';

const historyQuery = z.object({
  result: z.enum(TRADE_RESULTS).optional(),
  mode: z.enum(EXECUTION_MODES).optional(),
  symbol: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = parse(historyQuery, Object.fromEntries(new URL(req.url).searchParams));
    const trades = await prisma.trade.findMany({
      where: {
        userId: user.id,
        ...(q.result ? { result: q.result } : {}),
        ...(q.mode ? { mode: q.mode } : {}),
        ...(q.symbol ? { symbol: q.symbol.toUpperCase() } : {}),
      },
      orderBy: { openedAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = trades.length > q.limit;
    const items = hasMore ? trades.slice(0, q.limit) : trades;
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]?.id : null });
  } catch (err) {
    return handleError(err);
  }
}
