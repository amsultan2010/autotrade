import { NextResponse } from 'next/server';
import { sendWeeklyDigest } from '@/lib/email';
import { prisma } from '@autotrade/engine';
import { requireUser } from '@/lib/auth';

export async function POST() {
  try {
    const user = await requireUser();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const trades = await prisma.trade.findMany({
      where: { userId: user.id, closedAt: { gte: weekAgo }, result: { not: undefined } },
      select: { symbol: true, pnl: true, result: true },
    });

    if (trades.length === 0) {
      return NextResponse.json({ sent: false, reason: 'no_trades_this_week' });
    }

    const wins = trades.filter((t) => t.result === 'WIN').length;
    const losses = trades.filter((t) => t.result === 'LOSS').length;
    const pnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const symbolCounts: Record<string, number> = {};
    for (const t of trades) {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] ?? 0) + 1;
    }
    const topSymbol = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    await sendWeeklyDigest(user.email, { totalTrades: trades.length, wins, losses, pnl, topSymbol });
    return NextResponse.json({ sent: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
