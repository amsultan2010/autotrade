import { type NextRequest, NextResponse } from 'next/server';
import { runCycleForUser } from '@autotrade/engine/public';
import { handleError } from '@/lib/api-response';
import { getSupabaseServer } from '@/lib/supabase-server';
import { verifyBotSecret } from '@/lib/internal-auth';
import { countTradesOpenedSince } from '@/lib/db/trades';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'BOT_INTERNAL_SECRET not configured' }, { status: 500 });
  }

  try {
    verifyBotSecret(req.headers.get('x-internal-secret'));
  } catch {
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
      const [signalsRes, tradesOpenedCount] = await Promise.all([
        getSupabaseServer()
          .from('signals')
          .select('id', { count: 'exact', head: true })
          .eq('clerk_id', clerkId)
          .gte('created_at', cycleStartedMs),
        countTradesOpenedSince(clerkId, cycleStartedMs),
      ]);
      signalsGenerated = signalsRes.count ?? 0;
      tradesOpened = tradesOpenedCount;
    } catch {
      // best-effort counts
    }

    return NextResponse.json({ ...cycle, signalsGenerated, tradesOpened });
  } catch (err) {
    return handleError(err, { route: '/api/internal/bot/run-user' });
  }
}
