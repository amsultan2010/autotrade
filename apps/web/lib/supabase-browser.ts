'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseBrowserConfigured } from '@/lib/supabase-env';

type GetToken = (options?: { template?: string }) => Promise<string | null>;

/** Browser Supabase client authenticated via Clerk JWT (template: "supabase"). */
export function createSupabaseBrowserClient(getToken: GetToken): SupabaseClient | null {
  if (!isSupabaseBrowserConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )!.trim();

  return createBrowserClient(url, key, {
    global: {
      fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const token = await getToken({ template: 'supabase' });
        const headers = new Headers(init.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
