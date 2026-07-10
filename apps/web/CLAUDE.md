# Autotrade web app

This project uses **Supabase** (Postgres) and **Clerk** (auth).

- Database access: `apps/web/lib/db/` with `supabase-server.ts` (service role)
- Client hooks: `apps/web/src/hooks/useApiQuery.ts`
- Migrations: `supabase/migrations/`
- Bot scans: prefer `apps/worker`; Vercel cron → `/api/internal/bot/scan-all` daily backup only
