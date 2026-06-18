import { type NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma, runCycleForUser } from '@autotrade/engine';
import { capture } from '@/lib/analytics';

// Internal endpoint called by the Convex bot cron.
// Protected by BOT_INTERNAL_SECRET — never expose this to clients.
export async function POST(req: NextRequest) {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'BOT_INTERNAL_SECRET not configured' }, { status: 500 });
  }

  const incomingSecret = req.headers.get('x-internal-secret');
  if (incomingSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let clerkId: string;
  try {
    const body = (await req.json()) as { clerkId?: string };
    if (!body.clerkId) throw new Error('Missing clerkId');
    clerkId = body.clerkId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Look up the Prisma userId from the Clerk ID.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let signalsGenerated = 0;
  let tradesOpened = 0;

  const tradesBefore = await prisma.trade.count({
    where: { userId: user.id, result: 'OPEN' },
  });

  try {
    await Sentry.withScope(async (scope) => {
      scope.setUser({ id: clerkId });
      scope.setTag('bot_cycle', 'true');
      await runCycleForUser(user.id);
    });
  } catch (err) {
    Sentry.captureException(err, { extra: { clerkId, userId: user.id } });
    throw err;
  }

  const tradesAfter = await prisma.trade.count({
    where: { userId: user.id, result: 'OPEN' },
  });
  tradesOpened = Math.max(0, tradesAfter - tradesBefore);

  signalsGenerated = await prisma.signal.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 1000) },
    },
  });

  if (signalsGenerated > 0) {
    capture(clerkId, {
      event: 'signal_generated',
      properties: { userId: clerkId, symbol: 'batch', direction: 'mixed', confidence: 0 },
    });
  }

  if (tradesOpened > 0) {
    capture(clerkId, {
      event: 'trade_opened',
      properties: { userId: clerkId, symbol: 'batch', side: 'mixed', mode: 'PAPER' },
    });
  }

  return NextResponse.json({ ok: true, signalsGenerated, tradesOpened });
}
