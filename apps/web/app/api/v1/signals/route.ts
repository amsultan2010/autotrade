import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getSupabaseServer } from '@/lib/supabase-server';
import { parse } from '@autotrade/engine/public';

function signalCreatedAtMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 1e11) return asNum;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Recent signals for the current user, read from Supabase.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { limit } = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(100).default(12) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );

    const { data, error } = await getSupabaseServer()
      .from('signals')
      .select('id, ticker, action, strategy, confidence, entry_reason, created_at')
      .eq('clerk_id', user.clerkId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Supabase signals read failed: ${error.message}`);

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      ticker: row.ticker as string,
      action: row.action as string,
      strategy: row.strategy as string,
      confidence: row.confidence as number,
      entryReason: row.entry_reason as string,
      createdAt: signalCreatedAtMs(row.created_at),
    }));

    return ok(items);
  } catch (err) {
    return handleError(err, { route: '/api/v1/signals' });
  }
}
