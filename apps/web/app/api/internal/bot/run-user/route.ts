import { type NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma, runCycleForUser } from '@autotrade/engine';
import { capture } from '@/lib/analytics';
import { convexServer } from '@/lib/convex-server';
import { makeFunctionReference } from 'convex/server';

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

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const settings = await prisma.botSettings.findUnique({
    where: { userId: user.id },
    select: { mode: true },
  });
  const botMode = settings?.mode ?? 'PAPER';

  // Snapshot open trade IDs before the cycle so we can diff what changed.
  const cycleStartedAt = new Date();
  const openBefore = await prisma.trade.findMany({
    where: { userId: user.id, result: 'OPEN' },
    select: { id: true },
  });
  const openBeforeIds = new Set(openBefore.map((t) => t.id));

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

  // Find trades newly opened or closed during this cycle.
  const newlyOpened = await prisma.trade.findMany({
    where: { userId: user.id, openedAt: { gte: cycleStartedAt } },
    select: {
      symbol: true,
      exchange: true,
      side: true,
      mode: true,
      qty: true,
      entryPrice: true,
      stopLoss: true,
      takeProfit: true,
      strategy: true,
      confidence: true,
      entryReason: true,
      brokerOrderId: true,
      openedAt: true,
    },
  });

  const newlyClosed = await prisma.trade.findMany({
    where: {
      userId: user.id,
      id: { in: [...openBeforeIds] },
      result: { not: 'OPEN' },
    },
    select: { symbol: true, mode: true, exitPrice: true, exitReason: true },
  });

  // Sync newly opened trades to Convex so they appear in the UI (best-effort).
  for (const trade of newlyOpened) {
    try {
      await convexServer.mutation(makeFunctionReference<'mutation'>('trades:syncFromBot'), {
        clerkId,
        symbol: trade.symbol,
        exchange: trade.exchange,
        side: trade.side as 'LONG' | 'SHORT',
        mode: trade.mode as 'PAPER' | 'LIVE',
        qty: trade.qty,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss ?? undefined,
        takeProfit: trade.takeProfit ?? undefined,
        strategy: trade.strategy,
        confidence: trade.confidence,
        entryReason: trade.entryReason,
        brokerOrderId: trade.brokerOrderId ?? undefined,
        openedAt: trade.openedAt.getTime(),
      });
    } catch {
      // Non-fatal: Postgres is source of truth; Convex sync is best-effort.
    }
  }

  // Sync closed trades to Convex (best-effort).
  for (const trade of newlyClosed) {
    if (!trade.exitPrice) continue;
    try {
      await convexServer.mutation(makeFunctionReference<'mutation'>('trades:closeFromBotBySymbol'), {
        clerkId,
        symbol: trade.symbol,
        mode: trade.mode as 'PAPER' | 'LIVE',
        exitPrice: trade.exitPrice,
        exitReason: trade.exitReason ?? 'Closed by bot',
      });
    } catch {
      // Non-fatal.
    }
  }

  const tradesOpened = newlyOpened.length;
  const signalsGenerated = await prisma.signal.count({
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
      properties: { userId: clerkId, symbol: 'batch', side: 'mixed', mode: botMode },
    });
  }

  return NextResponse.json({ ok: true, signalsGenerated, tradesOpened });
}
