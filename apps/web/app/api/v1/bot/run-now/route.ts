import { NextResponse } from 'next/server';
import {
  releaseScanLock,
  runCycleForUser,
  shouldAdvanceScanSchedule,
  tryAcquireScanLock,
} from '@autotrade/engine/public';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/api-response';
import { recordScanCompleted } from '@/lib/db/scan';
import { getSupabaseServer } from '@/lib/supabase-server';
import { countTradesOpenedSince } from '@/lib/db/trades';

export const maxDuration = 60;

const SCAN_LOCK_TTL_MS = (maxDuration + 30) * 1000;

export async function POST() {
  try {
    const user = await requireUser();
    const lockedBy = `run-now:${user.clerkId}`;
    const acquired = await tryAcquireScanLock(user.clerkId, lockedBy, SCAN_LOCK_TTL_MS);
    if (!acquired) {
      return NextResponse.json(
        { error: 'A scan is already running for this account. Try again shortly.' },
        { status: 409 },
      );
    }

    const cycleStartedMs = Date.now();
    try {
      const cycle = await runCycleForUser(user.clerkId, { manualScan: true });
      if (shouldAdvanceScanSchedule(cycle)) {
        await recordScanCompleted(user.clerkId, Date.now());
      }

      let signalsGenerated = 0;
      let tradesOpened = 0;
      try {
        const [signalsRes, tradesOpenedCount] = await Promise.all([
          getSupabaseServer()
            .from('signals')
            .select('id', { count: 'exact', head: true })
            .eq('clerk_id', user.clerkId)
            .gte('created_at', cycleStartedMs),
          countTradesOpenedSince(user.clerkId, cycleStartedMs),
        ]);
        signalsGenerated = signalsRes.count ?? 0;
        tradesOpened = tradesOpenedCount;
      } catch {
        // best-effort counts
      }

      return NextResponse.json({ ...cycle, signalsGenerated, tradesOpened });
    } finally {
      await releaseScanLock(user.clerkId, lockedBy).catch(() => undefined);
    }
  } catch (err) {
    return handleError(err, { route: '/api/v1/bot/run-now' });
  }
}
