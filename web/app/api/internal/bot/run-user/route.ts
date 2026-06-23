import { type NextRequest, NextResponse } from 'next/server';
import { runCycleForUser } from '@autotrade/engine/public';
import { handleError } from '@/lib/api-response';
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

/** Scan cycles fetch candles for every watchlist symbol — allow headroom on Vercel. */
export const maxDuration = 60;

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
  let manualScan = false;
  try {
    const body = (await req.json()) as { clerkId?: string; manual?: boolean };
    if (!body.clerkId) throw new Error('Missing clerkId');
    clerkId = body.clerkId;
    manualScan = body.manual === true;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const cycleStartedMs = Date.now();

  try {
    const cycle = await runCycleForUser(clerkId, { manualScan });

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

    return NextResponse.json({ ...cycle, signalsGenerated, tradesOpened });
  } catch (err) {
    return handleError(err, { route: '/api/internal/bot/run-user' });
  }
}
