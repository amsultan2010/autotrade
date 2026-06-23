import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { isStockMarketOpen, POPULAR_TICKERS } from '@autotrade/engine/public';
import { marketDataForUser } from '@/lib/market-data-server';

export async function GET() {
  try {
    const user = await requireUser();
    const marketOpen = await isStockMarketOpen().catch(() => true);

    let snaps: Record<string, { price: number; changePct: number | null }> = {};
    try {
      const md = await marketDataForUser(user.clerkId);
      if (md.getSnapshots) snaps = await md.getSnapshots(POPULAR_TICKERS.map((t) => t.symbol));
    } catch {
      /* degrade gracefully */
    }

    return ok({
      marketOpen,
      items: POPULAR_TICKERS.map((t) => {
        const s = snaps[t.symbol];
        return {
          ...t,
          exchange: t.kind === 'crypto' ? 'CRYPTO' : 'US',
          open: t.kind === 'crypto' ? true : marketOpen,
          price: s?.price ?? null,
          changePct: s?.changePct ?? null,
        };
      }),
    });
  } catch (err) {
    return handleError(err);
  }
}
