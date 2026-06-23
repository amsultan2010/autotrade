/** Performance analytics computed from the immutable trade ledger (req #12). */
import { prisma } from '../lib/prisma';
import type { PerformanceSummary } from '@autotrade/shared';

function since(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function computePerformance(userId: string): Promise<PerformanceSummary> {
  const [closed, openTrades] = await Promise.all([
    prisma.trade.findMany({
      where: { userId, result: { not: 'OPEN' } },
      orderBy: { closedAt: 'asc' },
      select: { pnl: true, result: true, closedAt: true },
    }),
    prisma.trade.count({ where: { userId, result: 'OPEN' } }),
  ]);

  const pnls = closed.map((t) => t.pnl ?? 0);
  const wins = closed.filter((t) => t.result === 'WIN');
  const losses = closed.filter((t) => t.result === 'LOSS');
  const totalPnl = pnls.reduce((a, b) => a + b, 0);

  const sumSince = (d: Date) =>
    closed.filter((t) => t.closedAt && t.closedAt >= d).reduce((a, t) => a + (t.pnl ?? 0), 0);

  const winPnls = wins.map((t) => t.pnl ?? 0);
  const lossPnls = losses.map((t) => t.pnl ?? 0);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  // Max drawdown from the cumulative P/L (equity) curve.
  let peak = 0;
  let cum = 0;
  let maxDrawdown = 0;
  for (const p of pnls) {
    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const decided = wins.length + losses.length;

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: decided ? Number(((wins.length / decided) * 100).toFixed(1)) : 0,
    totalPnl: Number(totalPnl.toFixed(2)),
    dailyPnl: Number(sumSince(since(1)).toFixed(2)),
    weeklyPnl: Number(sumSince(since(7)).toFixed(2)),
    monthlyPnl: Number(sumSince(since(30)).toFixed(2)),
    openTrades,
    bestTrade: pnls.length ? Number(Math.max(...pnls).toFixed(2)) : null,
    worstTrade: pnls.length ? Number(Math.min(...pnls).toFixed(2)) : null,
    avgWin: avg(winPnls) != null ? Number(avg(winPnls)!.toFixed(2)) : null,
    avgLoss: avg(lossPnls) != null ? Number(avg(lossPnls)!.toFixed(2)) : null,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
  };
}

/** Per-strategy and per-symbol breakdowns for the dashboard. */
export async function computeBreakdowns(userId: string): Promise<{
  byStrategy: Array<{ key: string; trades: number; wins: number; pnl: number }>;
  bySymbol: Array<{ key: string; trades: number; wins: number; pnl: number }>;
}> {
  const closed = await prisma.trade.findMany({
    where: { userId, result: { not: 'OPEN' } },
    select: { strategy: true, symbol: true, result: true, pnl: true },
  });

  const group = (pick: (t: (typeof closed)[number]) => string) => {
    const map = new Map<string, { key: string; trades: number; wins: number; pnl: number }>();
    for (const t of closed) {
      const key = pick(t);
      const row = map.get(key) ?? { key, trades: 0, wins: 0, pnl: 0 };
      row.trades += 1;
      if (t.result === 'WIN') row.wins += 1;
      row.pnl += t.pnl ?? 0;
      map.set(key, row);
    }
    return [...map.values()].map((r) => ({ ...r, pnl: Number(r.pnl.toFixed(2)) }));
  };

  return { byStrategy: group((t) => t.strategy), bySymbol: group((t) => t.symbol) };
}
