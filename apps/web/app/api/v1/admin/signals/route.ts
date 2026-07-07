import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getSupabaseServer } from '@/lib/supabase-server';
import { parse } from '@autotrade/engine/public';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { limit } = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }),
      Object.fromEntries(new URL(req.url).searchParams),
    );

    const { data, error } = await getSupabaseServer()
      .from('signals')
      .select(
        'id, clerk_id, ticker, exchange, price, timeframe, strategy, action, confidence, risk_level, entry_reason, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Supabase admin signals read failed: ${error.message}`);

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      clerkId: row.clerk_id as string,
      ticker: row.ticker as string,
      exchange: row.exchange as string,
      price: row.price as number,
      timeframe: row.timeframe as string,
      strategy: row.strategy as string,
      action: row.action as string,
      confidence: row.confidence as number,
      riskLevel: row.risk_level as string,
      entryReason: row.entry_reason as string,
      createdAt: new Date(row.created_at as string).getTime(),
    }));

    return ok(items);
  } catch (err) {
    return handleError(err);
  }
}
