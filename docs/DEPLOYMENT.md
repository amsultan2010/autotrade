# Deployment & configuration

Autotrade has **two backends that each need their own environment variables**:

| Where | What runs there | How to set env |
|---|---|---|
| **Vercel** (or `.env.local` locally) | The Next.js app + REST API routes + the bot engine (`engine`) | Vercel project settings / `.env.local` |
| **Convex** | Auth verification, the database, the cron, the bot actions | `npx convex env set NAME value` or the Convex dashboard |


## Automatic deploys (default workflow)

You do **not** need to run `pnpm convex:deploy` by hand after every merge.

| What | How it ships |
|---|---|
| **Next.js app** (UI, API routes, Sentry hooks) | Vercel auto-builds on every push to `main` |
| **Convex functions** (`web/convex/`) | GitHub Actions runs `convex deploy` on push to `main` when convex files change |

**One-time setup** (5 minutes): add a Convex Production Deploy Key to GitHub so the workflow can authenticate:

```bash
pnpm setup:convex-ci
```

That script stores `CONVEX_DEPLOY_KEY` in your GitHub repo secrets. After that, merge to `main` and both halves deploy on their own.

Manual fallback (rare): `pnpm deploy:convex` from the repo root.

The full variable list with comments is in [`web/.env.example`](../web/.env.example). This doc is the **deploy checklist** and a **symptom → fix** map.

---

## 1. Vercel checklist

**Root Directory:** `web` (not `apps/web`).

**Install / build commands:** leave **empty** in the Vercel dashboard so `web/vercel.json` is used. If you override them in the UI (e.g. `cd ../.. && pnpm install`), deploys will fail — that path was for the old `apps/web` layout.

Required (the app will not work without these):

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- `MARKET_DATA_PROVIDER=alpaca`  ← **defaults to `stooq`; must be `alpaca`**
- `ALPACA_API_KEY`, `ALPACA_API_SECRET`
- `BROKER_ENCRYPTION_KEY` (64 hex chars — `openssl rand -hex 32`)
- `BOT_INTERNAL_SECRET` (`openssl rand -hex 32`)
- `NEXT_PUBLIC_APP_URL` (this deployment's URL, e.g. `https://tryautotrade.com`)
- `CONVEX_URL` (same deployment as `NEXT_PUBLIC_CONVEX_URL`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — optional legacy; Clerk is primary auth
- `BILLING_ENABLED=false` (default — no Stripe required)
- `FOUNDER_LIVE_EMAIL=abdullahmsultan1@gmail.com` (founder live-trading bypass)

Optional: `STRIPE_*` (only when `BILLING_ENABLED=true`), `RESEND_*`, `NEXT_PUBLIC_POSTHOG_*`, `*_SENTRY_*`.

## 2. Convex dashboard checklist

`npx convex env set NAME value` for each:

- `CLERK_JWT_ISSUER_DOMAIN` — your Clerk issuer (`https://<subdomain>.clerk.accounts.dev`, or your production Frontend API URL).
- `BOT_INTERNAL_SECRET` — **identical** to the Vercel value.
- `NEXT_PUBLIC_APP_URL` — same deployed URL as Vercel.
- `BROKER_ENCRYPTION_KEY` — **identical** to the Vercel value (so creds encrypted in one place decrypt in the other).
- `BILLING_ENABLED` — `false` until Stripe is configured.
- `FOUNDER_LIVE_EMAIL` — same as Vercel (founder live-trading access).

## 3. Clerk dashboard checklist

- **JWT template** named exactly `convex` must exist (Convex → Clerk integration). Without it, the browser never sends a token Convex accepts.
- **Webhook** endpoint → `https://<your-app>/api/v1/webhooks/clerk`, subscribed to `user.created`, `user.updated`, `user.deleted`. Copy its signing secret into `CLERK_WEBHOOK_SECRET`.

## 4. Stripe (only if billing is live)

- Webhook endpoint → `https://<your-app>/api/v1/webhooks/stripe` (if present), secret into `STRIPE_WEBHOOK_SECRET`.

---

## Symptom → most likely cause

| Symptom | Likely cause | Fix |
|---|---|---|
| **Settings page stuck on "Loading…"** | User has no `botSettings` row in Convex (webhook never fired) **or** Convex can't verify the Clerk JWT | The app now self-heals via `ensureExists` on sign-in; if it persists, check `CLERK_JWT_ISSUER_DOMAIN` (Convex) + the `convex` JWT template (Clerk) |
| **Watchlist search returns nothing / can't add symbols** | `MARKET_DATA_PROVIDER` not set to `alpaca`, or `ALPACA_API_KEY/SECRET` missing, or engine env invalid | Set `MARKET_DATA_PROVIDER=alpaca` + Alpaca keys; ensure `CONVEX_URL` and `JWT_*` are set |
| **"Start Bot" does nothing** | Missing Convex records (see settings) — the mutation threw `Bot settings not found` and the error is now surfaced in the UI | Self-heal handles it; otherwise verify the Convex/Clerk auth bridge |
| **"Scan Now" errors** | `BOT_INTERNAL_SECRET` / `NEXT_PUBLIC_APP_URL` not set in **Convex**, or user missing in Convex | Set those Convex vars; sign in once so Clerk webhook creates the user row |
| **Dashboard shows no Alpaca account/positions** | Broker not connected, or (fixed) the client was reading the wrong response shape | Connect Alpaca in Settings; ensure broker-cred sync env is set |
| **Blue banner: "Alpaca connected but no positions yet"** | Normal — connection works; bot has not opened a trade yet | Start Bot → Scan Now; look for `X trades opened` in the green banner |

---

## How to verify after configuring

1. Sign in. **Settings** should load with default values (not spin).
2. **Watchlist** → type `AAPL` → Alpaca-backed results appear → click to add → it appears in the table with a price.
3. **Dashboard → Start Bot** flips the badge to `PAPER`. **Scan Now** returns without an error banner.
4. Connect Alpaca in **Settings** → the Dashboard top bar shows `Alpaca paper · buying power …`.
