import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getMarketData, liveEngine } from '@autotrade/engine';
import { ok, handleError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get('symbols') ?? '';
    const symbols = symbolsParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (symbols.length === 0) return ok([]);

    let snapshots: Record<string, { price: number; changePct: number | null }> = {};
    try {
      const md = getMarketData();
      if (md.getSnapshots) snapshots = await md.getSnapshots(symbols);
    } catch { /* degrade gracefully */ }

    return ok(
      symbols.map((sym) => {
        const live = liveEngine.priceOf(sym);
        const snap = snapshots[sym];
        return {
          symbol: sym,
          price: live ?? snap?.price ?? null,
          changePct: snap?.changePct ?? null,
          live: live != null,
        };
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}
