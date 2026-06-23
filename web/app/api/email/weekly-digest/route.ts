import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { sendWeeklyDigest } from '@/lib/email';
import { prisma } from '@autotrade/engine/public';
import { requireUser } from '@/lib/auth';

async function sendDigestForUserId(userId: string, email: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const trades = await prisma.trade.findMany({
    where: { userId, closedAt: { gte: weekAgo }, result: { not: undefined } },
    select: { symbol: true, pnl: true, result: true },
  });

  if (trades.length === 0) return { sent: false, reason: 'no_trades_this_week' };

  const wins = trades.filter((t) => t.result === 'WIN').length;
  const losses = trades.filter((t) => t.result === 'LOSS').length;
  const pnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const symbolCounts: Record<string, number> = {};
  for (const t of trades) {
    symbolCounts[t.symbol] = (symbolCounts[t.symbol] ?? 0) + 1;
  }
  const topSymbol = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  await sendWeeklyDigest(email, { totalTrades: trades.length, wins, losses, pnl, topSymbol });
  return { sent: true };
}

// Called by the Convex cron with x-internal-secret — sends to ALL active users.
// Can also be triggered by an authenticated user to send their own digest.
export async function POST(req: NextRequest) {
  const incomingSecret = req.headers.get('x-internal-secret');
  const configuredSecret = process.env.BOT_INTERNAL_SECRET;

  if (incomingSecret && configuredSecret && incomingSecret === configuredSecret) {
    // Cron path: send digest to every active user who has trades this week.
    try {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, email: true },
      });

      const results = await Promise.allSettled(
        users.map((u) => sendDigestForUserId(u.id, u.email)),
      );

      const sent = results.filter(
        (r) => r.status === 'fulfilled' && r.value.sent,
      ).length;

      return NextResponse.json({ sent, total: users.length });
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // User-authenticated path: send digest for the current user only.
  try {
    const user = await requireUser();
    const result = await sendDigestForUserId(user.id, user.email);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
