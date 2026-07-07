# Autotrade web app

This project uses **Supabase** (Postgres) and **Clerk** (auth).

- Database access: `apps/web/lib/db/` with `supabase-server.ts` (service role)
- Client hooks: `apps/web/src/hooks/useApiQuery.ts`
- Migrations: `supabase/migrations/`
- Bot cron: `apps/web/vercel.json` → `/api/internal/bot/scan-all`
