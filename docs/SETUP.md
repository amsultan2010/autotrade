# Production setup checklist

You **are** using Supabase (database + auth JWT for RLS). A **Supabase migration** is just the SQL in `supabase/migrations/` applied to that Postgres database — not a separate product or a move away from Supabase.

You **do not** need Railway unless you want the trading bot running 24/7 in the cloud. Railway was only the suggested host for `apps/worker`. The website runs on **Vercel**; the database on **Supabase**.

## Architecture

| Piece | Host | Status |
|-------|------|--------|
| Website + API (`apps/web`) | Vercel | Root dir set to `apps/web` |
| Database | Supabase project `Autotrade` | Live data; migration `003` applied |
| Bot scheduler (`apps/worker`) | Your machine or a VPS | Optional; not on Railway unless you choose |

## One-time dashboard steps

### 1. Supabase
- Project already has your users/trades data.
- Migrations `001`–`003` should be applied (worker needs `scan_locks` + `idempotency_keys` from `003`).

### 2. Clerk
- Create webhook: `https://tryautotrade.com/api/v1/webhooks/clerk` (or your Vercel URL while testing).
- Copy **Signing secret** → `CLERK_WEBHOOK_SECRET` in Vercel env + `apps/web/.env.local`.
- JWT template named `supabase` for Supabase third-party auth (if not already).

### 3. Vercel (project `autotrade`)
- **Root Directory**: `apps/web` (updated).
- Copy all vars from `apps/web/.env.example` into Vercel → Settings → Environment Variables (Production + Preview).
- Remove any legacy `CONVEX_*` variables.
- Redeploy after env is complete.

### 4. Stripe (if `BILLING_ENABLED=true`)
- Webhook: `https://tryautotrade.com/api/v1/webhooks/stripe`

### 5. Worker (optional, for always-on bot)
- Run locally: `pnpm dev:worker` (needs same env as web for Supabase + Alpaca).
- For production 24/7: deploy `apps/worker` to Render, Fly.io, a VPS, **or** Railway — your choice.

## Verify locally

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill keys
bash scripts/validate-env.sh
pnpm --filter @autotrade/shared build
pnpm dev:web    # http://localhost:3000
pnpm dev:worker # http://localhost:8080/health
```

## Verify production

1. Vercel deployment succeeds (not `ERROR`).
2. Sign in with Clerk on production URL.
3. Dashboard loads trades/signals from Supabase.
4. Worker health responds if you run the worker somewhere.

