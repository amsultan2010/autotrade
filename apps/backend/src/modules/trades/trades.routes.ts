import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TRADE_RESULTS, EXECUTION_MODES } from '@autotrade/shared';
import { prisma } from '../../lib/prisma.js';
import { parse } from '../../lib/validate.js';
import { requireEntitled } from '../../middleware/guards.js';
import { computeBreakdowns, computePerformance } from './trades.service.js';
import { closeTradeAtMarket } from '../../services/execution/paper.engine.js';
import { loadUserBroker } from '../../lib/broker-credentials.js';
import { BadRequestError } from '../../lib/errors.js';

const historyQuery = z.object({
  result: z.enum(TRADE_RESULTS).optional(),
  mode: z.enum(EXECUTION_MODES).optional(),
  symbol: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(), // trade id for pagination
});

export async function tradesRoutes(app: FastifyInstance): Promise<void> {
  // Full trade history (req #13), newest first, cursor-paginated.
  app.get('/trades', requireEntitled, async (req) => {
    const user = req.authUser!;
    const q = parse(historyQuery, req.query);
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
    return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
  });

  app.get('/trades/:id', requireEntitled, async (req) => {
    const user = req.authUser!;
    const { id } = req.params as { id: string };
    return prisma.trade.findFirst({ where: { id, userId: user.id }, include: { signal: true } });
  });

  // Manually close an open position at the current market price.
  app.post('/trades/:id/close', requireEntitled, async (req) => {
    const user = req.authUser!;
    const { id } = req.params as { id: string };
    const broker = await loadUserBroker(user.id);
    const result = await closeTradeAtMarket(id, user.id, broker ?? undefined);
    if (!result.closed) throw new BadRequestError(result.reason ?? 'Could not close trade');
    return result;
  });

  // Aggregate performance for the dashboard (req #12).
  app.get('/performance', requireEntitled, async (req) => {
    const user = req.authUser!;
    return computePerformance(user.id);
  });

  app.get('/performance/breakdowns', requireEntitled, async (req) => {
    const user = req.authUser!;
    return computeBreakdowns(user.id);
  });

  // Recent decisions feed (BUY/SELL/HOLD/AVOID), for the activity panel.
  app.get('/signals', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.signal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });
}
