# Production setup checklist

You **are** using Supabase (database + auth JWT for RLS). Apply SQL in `supabase/migrations/` to your Postgres project.

You **do not** need a separate worker host unless you want scans outside Vercel cron. The website runs on **Vercel**; the database on **Supabase**.

## Architecture

| Piece | Host | Status |
|-------|------|--------|
| Website + API (`apps/web`) | Vercel | Root dir `apps/web` |
| Database | Supabase | Apply migrations `001`–`005` |
| Bot scheduler | Vercel cron (daily backup) + optional `apps/worker` | Hobby plan: max 1×/day cron; deploy worker for real scan intervals |
| Optional worker (`apps/worker`) | VPS / Render / local | For always-on scans beyond cron |

## One-time dashboard steps

### 1. Supabase
- Apply migrations `001` through `005` (includes `scan_locks`, signals `created_at` fix, Resend contact id).
- Remove any legacy `CONVEX_*` env vars from Vercel.

### 2. Clerk
- Webhook: `https://tryautotrade.com/api/v1/webhooks/clerk`
- Copy signing secret → `CLERK_WEBHOOK_SECRET`
- JWT template named `supabase` for Supabase third-party auth (if not already).

### 3. Vercel
- **Root Directory**: `apps/web`
- Copy vars from `apps/web/.env.example` (Production **and** Preview).
- Required: `CRON_SECRET`, `BOT_INTERNAL_SECRET`, `BROKER_ENCRYPTION_KEY` (generate with `openssl rand -hex 32`).
- Redeploy after env is complete.

### 4. Stripe (later — when `BILLING_ENABLED=true`)
- Webhook: `https://tryautotrade.com/api/v1/webhooks/stripe`

### 5. Optional worker
- `pnpm dev:worker` locally with same Supabase + Alpaca env as web.

## Verify locally

```bash
cp apps/web/.env.example apps/web/.env.local
# fill secrets
bash scripts/validate-env.sh
pnpm dev:web
```

Health check: `GET /api/health` → `{ ok: true }`

Cron auth: Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes.
