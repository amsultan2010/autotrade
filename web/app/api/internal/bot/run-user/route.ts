import { type NextRequest, NextResponse } from 'next/server';
import { ErrorCodes } from '@autotrade/shared';
import { captureAppErrorServer } from '@/lib/error-tracking-server';
import { runCycleForUser } from '@autotrade/engine/public';
import { convexServer } from '@/lib/convex-server';
import { makeFunctionReference } from 'convex/server';

const countSignalsSince = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; sinceMs: number },
  number
>('engineData:countSignalsSince');

const countTradesOpenedSince = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; sinceMs: number },
  number
>('engineData:countTradesOpenedSince');

function internalSecret(): string | null {
  return process.env.BOT_INTERNAL_SECRET ?? null;
}

// Internal endpoint called by the Convex bot cron.
// Protected by BOT_INTERNAL_SECRET — never expose this to clients.
export async function POST(req: NextRequest) {
  const secret = internalSecret();
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

  const cycleStartedMs = Date.now();

  try {
    await runCycleForUser(clerkId);
  } catch (err) {
    captureAppErrorServer(ErrorCodes.BOT_CYCLE, err, {
      route: '/api/internal/bot/run-user',
      clerkId,
      bot_cycle: true,
    });
    throw err;
  }

  let signalsGenerated = 0;
  let tradesOpened = 0;
  try {
    [signalsGenerated, tradesOpened] = await Promise.all([
      convexServer.query(countSignalsSince, { secret, clerkId, sinceMs: cycleStartedMs }),
      convexServer.query(countTradesOpenedSince, { secret, clerkId, sinceMs: cycleStartedMs }),
    ]);
  } catch {
    // Counts are best-effort; cycle already ran.
  }

  return NextResponse.json({ ok: true, signalsGenerated, tradesOpened });
}
