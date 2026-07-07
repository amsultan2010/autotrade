'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

type GetToken = (options?: { template?: string }) => Promise<string | null>;

/** Browser Supabase client authenticated via Clerk JWT (template: "supabase"). */
export function createSupabaseBrowserClient(getToken: GetToken): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for the browser client.',
    );
  }

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
