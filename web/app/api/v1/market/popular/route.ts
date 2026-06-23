import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getMarketData, isStockMarketOpen, POPULAR_TICKERS } from '@autotrade/engine/public';

export async function GET() {
  try {
    await requireUser();
    const marketOpen = await isStockMarketOpen().catch(() => false);

    // Live price + today's % change for each recommended ticker (best-effort).
    let snaps: Record<string, { price: number; changePct: number | null }> = {};
    try {
      const md = getMarketData();
      if (md.getSnapshots) snaps = await md.getSnapshots(POPULAR_TICKERS.map((t) => t.symbol));
    } catch {
      /* degrade gracefully — the list still renders without live stats */
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
