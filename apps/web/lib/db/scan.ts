import { normalizeScanInterval } from '@autotrade/shared';
import { getSupabaseServer } from '@/lib/supabase-server';
import type { BotSettingsRow } from './row-mappers';

export async function getUsersDueForScan(now = Date.now()): Promise<string[]> {
  const sb = getSupabaseServer();
  const { data: settings, error } = await sb
    .from('bot_settings')
    .select('clerk_id, mode, scan_interval_seconds, last_scan_at')
    .neq('mode', 'DISABLED');
  if (error) throw new Error(error.message);

  const results: string[] = [];
  for (const s of (settings ?? []) as Pick<BotSettingsRow, 'clerk_id' | 'mode' | 'scan_interval_seconds' | 'last_scan_at'>[]) {
    const { data: user } = await sb
      .from('users')
      .select('status')
      .eq('clerk_id', s.clerk_id)
      .maybeSingle();
    if (!user || user.status !== 'ACTIVE') continue;

    const intervalMs = normalizeScanInterval(s.scan_interval_seconds ?? undefined) * 1000;
    const lastScan = s.last_scan_at ?? 0;
    if (now - lastScan >= intervalMs) {
      results.push(s.clerk_id);
    }
  }
  return results;
}

export async function recordScanCompleted(clerkId: string, at: number): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('bot_settings')
    .update({ last_scan_at: at })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
}
