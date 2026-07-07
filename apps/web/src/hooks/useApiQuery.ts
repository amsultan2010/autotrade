'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ErrorCodes } from '@autotrade/shared';
import { reportTrackedError } from '@/lib/error-tracking';

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
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    try {
      const res = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        const message = body.error?.message ?? res.statusText;
        if (res.status >= 500) {
          reportTrackedError(ErrorCodes.API_CLIENT, new Error(message), {
            route: `/api/v1${path}`,
            status: res.status,
          });
        }
        throw new Error(message);
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
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchData();
    };
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void fetchData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchData, intervalMs, enabled]);

  return { data, loading, error, refresh };
}
