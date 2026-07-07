import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { sendWeeklyDigest } from '@/lib/email';
import { requireUser } from '@/lib/auth';
import { listActiveUsers } from '@/lib/db/users';
import { getDigestTrades } from '@/lib/db/trades';
import { isCronOrBotAuth } from '@/lib/internal-auth';

async function sendDigestForClerkId(clerkId: string, email: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const trades = await getDigestTrades(clerkId, weekAgo.getTime());

  let stats = null;
  if (trades.length > 0) {
    const wins = trades.filter((t) => t.result === 'WIN').length;
    const losses = trades.filter((t) => t.result === 'LOSS').length;
    const pnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const symbolCounts: Record<string, number> = {};
    for (const t of trades) {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] ?? 0) + 1;
    }
    const topSymbol = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    stats = { totalTrades: trades.length, wins, losses, pnl, topSymbol };
  }

  await sendWeeklyDigest(email, stats);
  return { sent: true };
}

export async function POST(req: NextRequest) {
  if (isCronOrBotAuth(req)) {
    try {
      const users = await listActiveUsers();
      const results = await Promise.allSettled(
        users.map((u) => sendDigestForClerkId(u.clerkId, u.email)),
      );
      const sent = results.filter((r) => r.status === 'fulfilled' && r.value.sent).length;
      return NextResponse.json({ sent, total: users.length });
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  try {
    const user = await requireUser();
    const result = await sendDigestForClerkId(user.clerkId, user.email);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
