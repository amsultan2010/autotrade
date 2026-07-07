'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useSupabase } from '@/components/SupabaseProvider';

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function mapSupabaseRow<T extends object>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamelKey(key)] = value;
  }
  if (typeof out.id === 'string') out._id = out.id;
  return out as T;
}

interface UseSupabaseTableOptions {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
}

export function useSupabaseTable<T extends object>(
  table: string,
  { select = '*', orderBy, enabled = true }: UseSupabaseTableOptions = {},
): { data: T[] | undefined; loading: boolean; error: Error | null } {
  const supabase = useSupabase();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerkId = user?.id;
  const instanceId = useId().replace(/:/g, '');
  const [rows, setRows] = useState<T[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const orderKey = useMemo(
    () => (orderBy ? `${orderBy.column}:${orderBy.ascending ?? true}` : ''),
    [orderBy],
  );

  useEffect(() => {
    if (!enabled || !isLoaded || !isSignedIn || !clerkId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      let query = supabase.from(table).select(select).eq('clerk_id', clerkId!);
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }
      const { data, error: qErr } = await query;
      if (cancelled) return;
      if (qErr) {
        setError(new Error(qErr.message));
        setLoading(false);
        return;
      }
      setRows((data ?? []).map((row) => mapSupabaseRow<T>(row as unknown as Record<string, unknown>)));
      setError(null);
      setLoading(false);
    }

    void load();

    const channelName = `rt:${table}:${clerkId}:${instanceId}`;
    const channel = supabase.channel(channelName);
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `clerk_id=eq.${clerkId}` },
      () => {
        void load();
      },
    );
    channel.subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, table, select, orderKey, enabled, isLoaded, isSignedIn, clerkId, instanceId]);

  return { data: rows, loading, error };
}
