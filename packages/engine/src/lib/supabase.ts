import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for the engine.
 *
 * Holds the high-volume, append-only logs (signals, audit_logs) that would
 * otherwise blow the Convex quota. Uses the service-role key, so it MUST never
 * run in a browser. RLS is enabled on these tables with no policies, so the
 * service role is the only thing that can read/write them.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the Supabase-backed logs.',
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
