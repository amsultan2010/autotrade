# Autotrade web app

This project uses **Supabase (Postgres)** as its primary database and **Clerk** for auth.

- Server data access: `web/lib/db/` (service role via `web/lib/supabase-server.ts`)
- Client reads: Supabase Realtime via `web/src/hooks/useSupabaseTable.ts` and REST via `web/src/hooks/useApiQuery.ts`
- Bot cron: Vercel crons hit `/api/internal/bot/scan-all` (every 5 min) and `/api/email/weekly-digest` (Monday 8am UTC)
- Migrations: `supabase/migrations/`
- One-time Convex data import: `npx tsx scripts/migrate-convex-to-supabase.ts`
