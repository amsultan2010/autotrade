import { query } from './_generated/server';

function requireAuth(identity: { subject: string } | null): string {
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}

/** Compute performance summary from all trades for the current user. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkId = identity.subject;

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    const closed = trades.filter((t) => t.result !== 'OPEN' && t.pnl !== undefined);
    const open = trades.filter((t) => t.result === 'OPEN');

    const wins = closed.filter((t) => t.result === 'WIN');
    const losses = closed.filter((t) => t.result === 'LOSS');
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const now = Date.now();
    const dayMs = 86_400_000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    const dailyPnl = closed
      .filter((t) => t.closedAt && now - t.closedAt < dayMs)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);
    const weeklyPnl = closed
      .filter((t) => t.closedAt && now - t.closedAt < weekMs)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);
    const monthlyPnl = closed
      .filter((t) => t.closedAt && now - t.closedAt < monthMs)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);

    const pnlValues = closed.map((t) => t.pnl ?? 0);
    const winPnls = wins.map((t) => t.pnl ?? 0);
    const lossPnls = losses.map((t) => t.pnl ?? 0);

    // Max drawdown: largest peak-to-trough drop in cumulative PnL.
    let peak = 0;
    let cumulative = 0;
    let maxDrawdown = 0;
    for (const t of closed.sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0))) {
      cumulative += t.pnl ?? 0;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closed.length > 0 ? wins.length / closed.length : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      dailyPnl: Math.round(dailyPnl * 100) / 100,
      weeklyPnl: Math.round(weeklyPnl * 100) / 100,
      monthlyPnl: Math.round(monthlyPnl * 100) / 100,
      openTrades: open.length,
      bestTrade: pnlValues.length > 0 ? Math.max(...pnlValues) : null,
      worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : null,
      avgWin: winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : null,
      avgLoss: lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : null,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    };
  },
});

/** Per-strategy and per-symbol breakdown for the history view. */
export const breakdowns = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkId = identity.subject;

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    const closed = trades.filter((t) => t.result !== 'OPEN');

    // Group by strategy.
    const byStrategy: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
    // Group by symbol.
    const bySymbol: Record<string, { trades: number; wins: number; totalPnl: number }> = {};

    for (const t of closed) {
      const s = t.strategy;
      byStrategy[s] ??= { trades: 0, wins: 0, totalPnl: 0 };
      byStrategy[s].trades++;
      if (t.result === 'WIN') byStrategy[s].wins++;
      byStrategy[s].totalPnl += t.pnl ?? 0;

      const sym = t.symbol;
      bySymbol[sym] ??= { trades: 0, wins: 0, totalPnl: 0 };
      bySymbol[sym].trades++;
      if (t.result === 'WIN') bySymbol[sym].wins++;
      bySymbol[sym].totalPnl += t.pnl ?? 0;
    }

    const toArray = (map: typeof byStrategy) =>
      Object.entries(map).map(([key, v]) => ({
        key,
        ...v,
        winRate: v.trades > 0 ? v.wins / v.trades : 0,
        totalPnl: Math.round(v.totalPnl * 100) / 100,
      }));

    return { byStrategy: toArray(byStrategy), bySymbol: toArray(bySymbol) };
  },
});
