import { type NextRequest, NextResponse } from 'next/server';
import { ErrorCodes } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';
import { createClerkClient } from '@clerk/backend';
import { prisma, runCycleForUser, env, DEFAULT_WATCHLIST } from '@autotrade/engine/public';
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

  let user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });

  if (!user) {
    // Self-heal: user exists in Clerk but not yet in Postgres (webhook may have
    // missed on sign-up). Create them now, identical to requireUser() in lib/auth.ts.
    try {
      const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
      const clerkUser = await clerk.users.getUser(clerkId);
      const email = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;
      if (!email) return NextResponse.json({ error: 'Clerk user has no primary email' }, { status: 400 });
      const normalized = email.trim().toLowerCase();
      user = await prisma.user.upsert({
        where: { email: normalized },
        update: { clerkId },
        create: {
          email: normalized,
          clerkId,
          passwordHash: '',
          paperAccount: { create: { balance: env.PAPER_STARTING_BALANCE, equity: env.PAPER_STARTING_BALANCE } },
          botSettings: { create: {} },
          subscription: { create: { status: 'NONE' } },
          watchlist: { create: DEFAULT_WATCHLIST },
        },
        select: {
          id: true,
          role: true,
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      });
    } catch (err) {
      captureAppError(ErrorCodes.BOT_USER_CREATE, err, { route: '/api/internal/bot/run-user', clerkId });
      return NextResponse.json({ error: 'User not found and could not be auto-created' }, { status: 404 });
    }
  }

  // ── Mirror Convex config → Postgres ──────────────────────────────────────
  // Convex is the source of truth for what the user configures in the UI
  // (bot settings + watchlist), but the engine reads Postgres. Pull the
  // current config and mirror it just-in-time so the bot honors the user's
  // real watchlist and settings instead of stale Postgres defaults. Best-effort:
  // a sync failure falls back to the last-known Postgres config rather than
  // aborting the cycle.
  try {
    const config = (await convexServer.query(
      makeFunctionReference<'query'>('botInternal:getConfigForBot'),
      { clerkId },
    )) as {
      settings: null | {
        mode: 'DISABLED' | 'PAPER' | 'LIVE';
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        maxActiveTrades: number;
        maxTradeSize: number;
        riskPerTradePct: number;
        defaultStopPct: number;
        defaultTakeProfitPct: number;
        maxDailyLoss: number;
        tradingHoursStart: string;
        tradingHoursEnd: string;
        minConfidence: number;
        timeframes: string[];
        strategies: string[];
      };
      watchlist: Array<{ symbol: string; exchange: string; mic: string | null }>;
    };

    if (config.settings) {
      await prisma.botSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...config.settings },
        update: { ...config.settings },
      });
    }

    // Mirror the watchlist (Convex is source of truth): add new, drop removed.
    const existing = await prisma.watchedSymbol.findMany({
      where: { userId: user.id },
      select: { id: true, symbol: true, exchange: true },
    });
    const key = (s: string, e: string) => `${s}:${e}`;
    const desiredKeys = new Set(config.watchlist.map((w) => key(w.symbol, w.exchange)));
    const existingKeys = new Set(existing.map((w) => key(w.symbol, w.exchange)));
    const toDelete = existing.filter((w) => !desiredKeys.has(key(w.symbol, w.exchange)));
    const toCreate = config.watchlist.filter((w) => !existingKeys.has(key(w.symbol, w.exchange)));
    if (toDelete.length > 0) {
      await prisma.watchedSymbol.deleteMany({ where: { id: { in: toDelete.map((w) => w.id) } } });
    }
    if (toCreate.length > 0) {
      await prisma.watchedSymbol.createMany({
        data: toCreate.map((w) => ({
          userId: user.id,
          symbol: w.symbol,
          exchange: w.exchange,
          mic: w.mic ?? undefined,
        })),
        skipDuplicates: true,
      });
    }
  } catch (err) {
    captureAppError(ErrorCodes.BOT_CONFIG_SYNC, err, { route: '/api/internal/bot/run-user', clerkId });
  }

  const settings = await prisma.botSettings.findUnique({
    where: { userId: user.id },
    select: { mode: true },
  });
  const botMode = settings?.mode ?? 'PAPER';

  // Free-plan guard: LIVE cycles require an active subscription.
  // Admins and developers bypass this check.
  if (botMode === 'LIVE') {
    const isBypassRole = user.role === 'ADMIN' || user.role === 'DEVELOPER';
    if (!isBypassRole) {
      const sub = user.subscription;
      const periodOk = !sub?.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now();
      const entitled =
        sub !== null &&
        sub !== undefined &&
        (sub.status === 'ACTIVE' || sub.status === 'TRIALING') &&
        periodOk;
      if (!entitled) {
        return NextResponse.json(
          { ok: false, skipped: true, reason: 'live_requires_subscription' },
          { status: 200 },
        );
      }
    }
  }

  // Snapshot open trade IDs before the cycle so we can diff what changed.
  const cycleStartedAt = new Date();
  const openBefore = await prisma.trade.findMany({
    where: { userId: user.id, result: 'OPEN' },
    select: { id: true },
  });
  const openBeforeIds = new Set(openBefore.map((t) => t.id));

  try {
    await runCycleForUser(user.id);
  } catch (err) {
    captureAppError(ErrorCodes.BOT_CYCLE, err, {
      route: '/api/internal/bot/run-user',
      clerkId,
      userId: user.id,
      bot_cycle: true,
    });
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
