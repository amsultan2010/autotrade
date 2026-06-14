import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { isStockMarketOpen, POPULAR_TICKERS } from '@autotrade/engine';

export async function GET() {
  try {
    await requireUser();
    const marketOpen = await isStockMarketOpen().catch(() => false);
    return ok({
      marketOpen,
      items: POPULAR_TICKERS.map((t) => ({
        ...t,
        exchange: t.kind === 'crypto' ? 'CRYPTO' : 'US',
        open: t.kind === 'crypto' ? true : marketOpen,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
