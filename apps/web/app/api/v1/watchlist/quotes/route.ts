import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, getMarketData, liveEngine } from '@autotrade/engine';

export async function GET() {
  try {
    const user = await requireUser();
    const watched = await prisma.watchedSymbol.findMany({ where: { userId: user.id }, orderBy: { addedAt: 'asc' } });
    const symbols = [...new Set(watched.map((w) => w.symbol.toUpperCase()))];
    let snapshots: Record<string, { price: number; changePct: number | null }> = {};
    try {
      const md = getMarketData();
      if (md.getSnapshots) snapshots = await md.getSnapshots(symbols);
    } catch { /* degrade gracefully */ }
    return ok(watched.map((w) => {
      const sym = w.symbol.toUpperCase();
      const live = liveEngine.priceOf(sym);
      const snap = snapshots[sym];
      return { id: w.id, symbol: w.symbol, exchange: w.exchange, price: live ?? snap?.price ?? null, changePct: snap?.changePct ?? null, live: live != null };
    }));
  } catch (err) {
    return handleError(err);
  }
}
