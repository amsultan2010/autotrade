import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for the web app.
 *
 * Backs the high-volume, append-only logs (signals, audit_logs) that were
 * blowing the Convex quota. Uses the service-role key, so this module must
 * only ever be imported from server code (API routes / server actions),
 * never from a client component.
 */
let client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use Supabase-backed logs.',
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
