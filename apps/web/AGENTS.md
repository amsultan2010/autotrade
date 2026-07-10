# Autotrade web app

This project uses **Supabase (Postgres)** as its primary database and **Clerk** for auth.

- Server data access: `apps/web/lib/db/` (service role via `apps/web/lib/supabase-server.ts`)
- Client reads: REST via `apps/web/src/hooks/useApiQuery.ts` and Supabase Realtime where needed
- Bot scheduler: deploy `apps/worker` for always-on scans; Vercel cron hits `/api/internal/bot/scan-all` once daily as a backup (`apps/web/vercel.json`)
- Email digest cron: `/api/email/weekly-digest` (Monday 8:00 UTC)
- Migrations: `supabase/migrations/` (apply `001`–`005` in production)
- Env validation: `bash scripts/validate-env.sh apps/web/.env.local`
