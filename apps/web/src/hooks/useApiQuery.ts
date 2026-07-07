'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

interface UseApiQueryOptions {
  enabled?: boolean;
  intervalMs?: number;
  refreshKey?: string | number | boolean;
}

export function useApiQuery<T>(
  path: string,
  { enabled = true, intervalMs, refreshKey }: UseApiQueryOptions = {},
): { data: T | undefined; loading: boolean; error: Error | null; refresh: () => Promise<void> } {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? res.statusText);
      }
      const json = (await res.json()) as T;
      if (activeRef.current) {
        setData(json);
        setError(null);
      }
    } catch (err) {
      if (activeRef.current) {
        setError(err instanceof Error ? err : new Error('Request failed'));
      }
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [path, enabled, isLoaded, isSignedIn]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    activeRef.current = true;
    void fetchData();
    return () => {
      activeRef.current = false;
    };
  }, [fetchData, refreshKey]);

  useEffect(() => {
    if (!intervalMs || !enabled) return;
    const id = window.setInterval(() => void fetchData(), intervalMs);
    return () => window.clearInterval(id);
  }, [fetchData, intervalMs, enabled]);

  return { data, loading, error, refresh };
}
