import { normalizeScanInterval } from '@autotrade/shared';
import { getSupabaseServer } from '@/lib/supabase-server';
import type { BotSettingsRow } from './row-mappers';

export async function getUsersDueForScan(now = Date.now()): Promise<string[]> {
  const sb = getSupabaseServer();
  const [{ data: settings, error: settingsError }, { data: activeUsers, error: usersError }] =
    await Promise.all([
      sb
        .from('bot_settings')
        .select('clerk_id, mode, scan_interval_seconds, last_scan_at')
        .neq('mode', 'DISABLED'),
      sb.from('users').select('clerk_id').eq('status', 'ACTIVE'),
    ]);
  if (settingsError) throw new Error(settingsError.message);
  if (usersError) throw new Error(usersError.message);

  const activeIds = new Set((activeUsers ?? []).map((u) => u.clerk_id as string));
  const results: string[] = [];
  for (const s of (settings ?? []) as Pick<BotSettingsRow, 'clerk_id' | 'mode' | 'scan_interval_seconds' | 'last_scan_at'>[]) {
    if (!activeIds.has(s.clerk_id)) continue;

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
