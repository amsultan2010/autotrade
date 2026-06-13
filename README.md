# Quantara.ai

Personalized, subscription-gated AI trading bot. A **Windows desktop client
(`.exe`)** backed by a secure Node/TypeScript API. Paper trading runs on **real
market data**; live trading is architected to route only through licensed
brokers (never simulated).

> Design source of truth: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Monorepo layout

```
apps/backend     Fastify API: auth, subscription, market data, engines, admin
apps/desktop     Electron + React desktop app (the .exe)
packages/shared  Types shared by backend + desktop
```

## Prerequisites

- Node 20+ and pnpm 9+
- A PostgreSQL database — **no install needed for dev** (see below), or use any
  local/hosted Postgres for production
- A **free market-data API key** (Twelve Data — no card) to get live signals
- (Optional) Stripe keys for billing — dev/admin accounts bypass the paywall

### Zero-install local database

`pnpm --filter @alphabot/backend dev:db` starts a real, embedded PostgreSQL on
`localhost:5432` (user/pass `postgres/postgres`, database `alphabot`, data in
`apps/backend/.pgdata`). No Docker, no admin, no account. Leave it running in
its own terminal. For production, point `DATABASE_URL` at a managed Postgres.

## 1) Install

```bash
pnpm install          # all workspaces
pnpm build:shared     # build shared types once
```

## 2) Backend

```bash
# terminal 1 — start the zero-install dev database (leave running)
pnpm --filter @alphabot/backend dev:db

# terminal 2
cp apps/backend/.env.example apps/backend/.env      # then add TWELVEDATA_API_KEY
pnpm db:generate                                    # prisma client
pnpm --filter @alphabot/backend prisma:migrate      # create schema
pnpm --filter @alphabot/backend db:seed             # create a DEVELOPER login
pnpm dev:backend                                    # http://localhost:4000
```

Sanity-check the decision engine without any data key:

```bash
pnpm --filter @alphabot/backend exec tsx scripts/verify-engine.ts
```

Health check: `GET http://localhost:4000/health`.

**Seeded developer account** (`db:seed`): `dev@alphabot.ai` / `ChangeMe123!`
(override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). Developers and
admins **bypass the subscription paywall** by role (req #3).

## 3) Desktop app

```bash
pnpm dev:desktop      # launches Vite + Electron, points at localhost:4000
```

Build the installable Windows `.exe`:

```bash
pnpm --filter @alphabot/desktop dist     # → apps/desktop/release/Quantara.ai Setup x.y.z.exe
```

(Optional) drop a `build/icon.ico` in `apps/desktop/` to brand the installer.

## End-to-end smoke test

1. Start Postgres, run migrate + seed, start the backend.
2. Put a real `FINNHUB_API_KEY` in `apps/backend/.env` so the scan loop runs.
3. `pnpm dev:desktop`, sign in with the seeded developer account (skips paywall).
4. Add a few symbols on **Watchlist** → **Dashboard → Start bot** (or **Scan now**).
5. Decisions appear in the feed; approved entries become **paper trades** that
   close on stop/target and show in **Trade History** with full reasoning.

## Build status

| Area | Status |
|---|---|
| Architecture + DB schema (12 models) | ✅ |
| Auth (argon2id, JWT, rotating refresh + reuse detection) | ✅ |
| Subscription gate (Stripe checkout + webhook, role bypass) | ✅ |
| Market data service (provider interface + Finnhub) | ✅ |
| Analysis / decision / risk engines (multi-timeframe, explained) | ✅ |
| Paper engine + scan loop + per-user learning | ✅ |
| Watchlist / settings / trades / bot / admin routes | ✅ |
| Electron desktop app (.exe pipeline) | ✅ |
| Live broker adapter (Alpaca/IBKR) | ⏳ future (interface ready) |

## Security model (req #15)

- All secrets live in `apps/backend/.env` (server-side only). The desktop app
  **never** holds market-data or Stripe keys; it proxies through the backend.
- Subscription and role checks are enforced **server-side** on every gated route.
- Passwords: argon2id. Refresh tokens: stored only as SHA-256 hashes, rotated,
  with reuse detection. Desktop keeps the refresh token in OS-encrypted storage.
- Helmet headers, CORS allowlist, per-route rate limiting, Zod input validation.
- Every admin action is written to an immutable audit log.

## What "AI learning" means here (honest)

`LearningService` keeps per-user, per-strategy realized statistics and nudges a
bounded confidence multiplier toward setups that actually work on **that user's**
symbols. It is statistical personalization, not market prediction — no trading
system reliably forecasts markets, and nothing here implies guaranteed profit.
