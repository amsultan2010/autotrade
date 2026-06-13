import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TIMEFRAMES, type Timeframe } from '@autotrade/shared';
import { prisma } from '../../lib/prisma.js';
import { parse } from '../../lib/validate.js';
import { requireEntitled } from '../../middleware/guards.js';
import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { getMarketData } from '../../services/marketdata/index.js';
import { liveEngine } from '../../workers/liveEngine.js';
import { isStockMarketOpen } from '../../lib/alpaca.js';
import { POPULAR_TICKERS } from '../../config/popular.js';

const addSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  exchange: z.string().min(1).max(40).default('US'),
  mic: z.string().max(10).optional(),
});

export async function watchlistRoutes(app: FastifyInstance): Promise<void> {
  // List watched symbols (unbounded, req #4).
  app.get('/watchlist', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.watchedSymbol.findMany({
      where: { userId: user.id },
      orderBy: { addedAt: 'asc' },
    });
  });

  // Add a symbol — no artificial limit.
  app.post('/watchlist', requireEntitled, async (req, reply) => {
    const user = req.authUser!;
    const body = parse(addSchema, req.body);
    const created = await prisma.watchedSymbol.upsert({
      where: {
        userId_symbol_exchange: { userId: user.id, symbol: body.symbol, exchange: body.exchange },
      },
      update: {},
      create: { userId: user.id, symbol: body.symbol, exchange: body.exchange, mic: body.mic },
    });
    return reply.code(201).send(created);
  });

  app.delete('/watchlist/:id', requireEntitled, async (req, reply) => {
    const user = req.authUser;
    if (!user) throw new UnauthorizedError();
    const { id } = req.params as { id: string };
    const found = await prisma.watchedSymbol.findFirst({ where: { id, userId: user.id } });
    if (!found) throw new NotFoundError('Symbol not in your watchlist');
    await prisma.watchedSymbol.delete({ where: { id } });
    return reply.code(204).send();
  });

  // Watchlist with real-time prices: live stream price first, batched snapshot
  // for intraday % change. The desktop polls this every few seconds.
  app.get('/watchlist/quotes', requireEntitled, async (req) => {
    const user = req.authUser!;
    const watched = await prisma.watchedSymbol.findMany({
      where: { userId: user.id },
      orderBy: { addedAt: 'asc' },
    });
    const symbols = [...new Set(watched.map((w) => w.symbol.toUpperCase()))];
    let snapshots: Record<string, { price: number; changePct: number | null }> = {};
    try {
      const md = getMarketData();
      if (md.getSnapshots) snapshots = await md.getSnapshots(symbols);
    } catch {
      /* prices degrade to live-only / null */
    }
    return watched.map((w) => {
      const sym = w.symbol.toUpperCase();
      const live = liveEngine.priceOf(sym);
      const snap = snapshots[sym];
      return {
        id: w.id,
        symbol: w.symbol,
        exchange: w.exchange,
        price: live ?? snap?.price ?? null,
        changePct: snap?.changePct ?? null,
        live: live != null,
      };
    });
  });

  // Popular tickers to browse when the search bar is focused but empty.
  // Each carries an "open" flag (crypto is always open; stocks follow the
  // US market clock) so the UI can show what's tradeable right now.
  app.get('/market/popular', requireEntitled, async () => {
    const marketOpen = await isStockMarketOpen().catch(() => false);
    return {
      marketOpen,
      items: POPULAR_TICKERS.map((t) => ({
        ...t,
        exchange: t.kind === 'crypto' ? 'CRYPTO' : 'US',
        open: t.kind === 'crypto' ? true : marketOpen,
      })),
    };
  });

  // Symbol search + quote proxy the market data provider (keys stay server-side).
  app.get('/market/search', requireEntitled, async (req) => {
    const { q } = parse(z.object({ q: z.string().min(1).max(50) }), req.query);
    return getMarketData().searchSymbols(q);
  });

  app.get('/market/quote/:symbol', requireEntitled, async (req) => {
    const { symbol } = req.params as { symbol: string };
    return getMarketData().getQuote(symbol.toUpperCase());
  });

  // OHLCV candles for charting (stocks + crypto, any timeframe).
  const BAR_SECONDS: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '1d': 86_400,
  };
  app.get('/market/candles', requireEntitled, async (req) => {
    const { symbol, timeframe, limit } = parse(
      z.object({
        symbol: z.string().min(1).max(20),
        timeframe: z.enum(TIMEFRAMES).default('1h'),
        limit: z.coerce.number().int().min(20).max(1000).default(300),
      }),
      req.query,
    );
    const sym = symbol.toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    const from = now - BAR_SECONDS[timeframe] * limit;
    const candles = await getMarketData().getCandles(sym, timeframe, from, now);
    return { symbol: sym, timeframe, candles };
  });
}
