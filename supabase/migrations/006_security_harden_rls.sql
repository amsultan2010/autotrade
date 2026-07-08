-- Harden RLS on internal lock/idempotency tables (service-role only)
ALTER TABLE public.scan_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.scan_locks FROM anon, authenticated;
REVOKE ALL ON TABLE public.idempotency_keys FROM anon, authenticated;
GRANT ALL ON TABLE public.scan_locks TO service_role;
GRANT ALL ON TABLE public.idempotency_keys TO service_role;

-- Fix mutable search_path on auth/helper functions
ALTER FUNCTION public.auth_clerk_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.attach_updated_at_trigger(regclass) SET search_path = public, pg_temp;
