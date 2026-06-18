import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { TIMEFRAMES, type Timeframe } from '@autotrade/shared';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getMarketData, parse } from '@autotrade/engine';

const BAR_SECONDS: Record<Timeframe, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86_400 };

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { symbol, timeframe, limit } = parse(
      z.object({ symbol: z.string().min(1).max(20), timeframe: z.enum(TIMEFRAMES).default('1h'), limit: z.coerce.number().int().min(20).max(1000).default(300) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );
    const sym = symbol.toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    const from = now - BAR_SECONDS[timeframe] * limit;
    return ok({ symbol: sym, timeframe, candles: await getMarketData().getCandles(sym, timeframe, from, now) });
  } catch (err) {
    return handleError(err);
  }
}
