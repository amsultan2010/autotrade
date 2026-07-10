import { NextResponse } from 'next/server';
import {
  releaseScanLock,
  runCycleForUser,
  shouldAdvanceScanSchedule,
  tryAcquireScanLock,
} from '@autotrade/engine/public';
import { verifyCronAuth } from '@/lib/internal-auth';
import { getUsersDueForScan, recordScanCompleted } from '@/lib/db/scan';
import { getSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 300;

/** Cap parallel in-process scans so one cron invocation cannot stampede Active CPU. */
const SCAN_CONCURRENCY = 5;
const INSTANCE_ID = `vercel-scan-all:${process.env.VERCEL_REGION ?? 'local'}`;
/** Match route maxDuration so locks do not expire mid-cycle. */
const SCAN_LOCK_TTL_MS = (maxDuration + 60) * 1000;

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

async function recordBotCycle(meta: {
  clerkId: string;
  success: boolean;
  error?: string;
  signalsGenerated?: number;
  tradesOpened?: number;
  skipped?: boolean;
}): Promise<void> {
  try {
    await getSupabaseServer().from('audit_logs').insert({
      actor_clerk_id: meta.clerkId,
      action: 'bot_cycle',
      meta: {
        success: meta.success,
        error: meta.error,
        signalsGenerated: meta.signalsGenerated,
        tradesOpened: meta.tradesOpened,
        skipped: meta.skipped,
        source: 'vercel-scan-all',
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: Request) {
  return runScanAll(req);
}

export async function GET(req: Request) {
  return runScanAll(req);
}

async function runScanAll(req: Request) {
  try {
    verifyCronAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clerkIds = await getUsersDueForScan(Date.now());
  let scanned = 0;
  let skippedLocked = 0;
  let failed = 0;
  let deferred = 0;

  await mapPool(clerkIds, SCAN_CONCURRENCY, async (clerkId) => {
    const acquired = await tryAcquireScanLock(clerkId, INSTANCE_ID, SCAN_LOCK_TTL_MS);
    if (!acquired) {
      skippedLocked++;
      await recordBotCycle({ clerkId, success: true, skipped: true });
      return;
    }

    try {
      const cycle = await runCycleForUser(clerkId);
      if (shouldAdvanceScanSchedule(cycle)) {
        await recordScanCompleted(clerkId, Date.now());
        scanned++;
        await recordBotCycle({ clerkId, success: true });
      } else {
        deferred++;
        await recordBotCycle({
          clerkId,
          success: false,
          error: cycle.reason ?? 'scan_not_advanced',
        });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await recordBotCycle({ clerkId, success: false, error: msg });
    } finally {
      await releaseScanLock(clerkId, INSTANCE_ID).catch(() => undefined);
    }
  });

  return NextResponse.json({
    users: clerkIds.length,
    scanned,
    skippedLocked,
    failed,
    deferred,
  });
}
