import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { TIMEFRAMES, type Timeframe } from '@autotrade/shared';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { marketDataForUser } from '@/lib/market-data-server';

const BAR_SECONDS: Record<Timeframe, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86_400 };

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const batchSymbols = typeof params.symbols === 'string' ? params.symbols.trim() : '';

    if (batchSymbols) {
      const { symbols, timeframe, limit } = parse(
        z.object({
          symbols: z.string().min(1).max(200),
          timeframe: z.enum(TIMEFRAMES).default('1d'),
          limit: z.coerce.number().int().min(2).max(100).default(14),
        }),
        { ...params, symbols: batchSymbols },
      );

      const uniqueSymbols = [
        ...new Set(
          symbols
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
        ),
      ].slice(0, 12);

      const now = Math.floor(Date.now() / 1000);
      const from = now - BAR_SECONDS[timeframe] * limit;
      const md = await marketDataForUser(user.clerkId);
      const candlesBySymbol: Record<string, Array<{ c: number }>> = {};

      await Promise.all(
        uniqueSymbols.map(async (sym) => {
          try {
            const candles = await md.getCandles(sym, timeframe, from, now);
            candlesBySymbol[sym] = candles.map((c) => ({ c: c.c }));
          } catch {
            candlesBySymbol[sym] = [];
          }
        }),
      );

      return ok({ timeframe, candlesBySymbol });
    }

    const { symbol, timeframe, limit } = parse(
      z.object({ symbol: z.string().min(1).max(20), timeframe: z.enum(TIMEFRAMES).default('1h'), limit: z.coerce.number().int().min(20).max(1000).default(300) }),
      params,
    );
    const sym = symbol.toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    const from = now - BAR_SECONDS[timeframe] * limit;
    const md = await marketDataForUser(user.clerkId);
    return ok({ symbol: sym, timeframe, candles: await md.getCandles(sym, timeframe, from, now) });
  } catch (err) {
    return handleError(err);
  }
}
