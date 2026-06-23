import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { sendWeeklyDigest } from '@/lib/email';
import { requireUser } from '@/lib/auth';
import { convexServer } from '@/lib/convex-server';
import { makeFunctionReference } from 'convex/server';

const listActiveUsers = makeFunctionReference<
  'query',
  { secret: string },
  Array<{ clerkId: string; email: string }>
>('engineData:listActiveUsers');

const getDigestTrades = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; sinceMs: number },
  Array<{ symbol: string; pnl?: number; result: string }>
>('engineData:getDigestTrades');

function internalSecret(): string | null {
  return process.env.BOT_INTERNAL_SECRET ?? null;
}

async function sendDigestForClerkId(clerkId: string, email: string, secret: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const trades = await convexServer.query(getDigestTrades, {
    secret,
    clerkId,
    sinceMs: weekAgo.getTime(),
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
  const configuredSecret = internalSecret();

  if (incomingSecret && configuredSecret && incomingSecret === configuredSecret) {
    try {
      const users = await convexServer.query(listActiveUsers, { secret: configuredSecret });

      const results = await Promise.allSettled(
        users.map((u) => sendDigestForClerkId(u.clerkId, u.email, configuredSecret)),
      );

      const sent = results.filter(
        (r) => r.status === 'fulfilled' && r.value.sent,
      ).length;

      return NextResponse.json({ sent, total: users.length });
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  try {
    const user = await requireUser();
    const secret = configuredSecret;
    if (!secret) {
      return NextResponse.json({ error: 'BOT_INTERNAL_SECRET not configured' }, { status: 500 });
    }
    const result = await sendDigestForClerkId(user.clerkId, user.email, secret);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
