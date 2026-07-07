import { NotFoundError } from '@autotrade/engine/public';
import { getSupabaseServer } from '@/lib/supabase-server';
import { mapWatchedSymbol, type WatchedSymbolRow } from './row-mappers';

export async function listWatchlist(clerkId: string) {
  const { data, error } = await getSupabaseServer()
    .from('watched_symbols')
    .select('*')
    .eq('clerk_id', clerkId)
    .order('added_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as WatchedSymbolRow[]).map(mapWatchedSymbol);
}

export async function addToWatchlist(
  clerkId: string,
  args: { symbol: string; exchange: string; mic?: string },
): Promise<string> {
  const upper = args.symbol.toUpperCase();
  const { data: existing } = await getSupabaseServer()
    .from('watched_symbols')
    .select('id')
    .eq('clerk_id', clerkId)
    .eq('symbol', upper)
    .eq('exchange', args.exchange)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await getSupabaseServer()
    .from('watched_symbols')
    .insert({
      clerk_id: clerkId,
      symbol: upper,
      exchange: args.exchange,
      mic: args.mic,
      added_at: Date.now(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message);
  return data.id as string;
}

export async function removeFromWatchlist(clerkId: string, id: string): Promise<void> {
  const { data } = await getSupabaseServer()
    .from('watched_symbols')
    .select('clerk_id')
    .eq('id', id)
    .maybeSingle();
  if (!data || data.clerk_id !== clerkId) throw new NotFoundError('Not found');
  const { error } = await getSupabaseServer().from('watched_symbols').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
