# AGENTS.md

## Cursor Cloud specific instructions

Autotrade is a pnpm monorepo (Node >=22.13, pnpm 11.x). Packages: `web/` (Next.js
15 + Convex backend in `web/convex/`), `engine/` (trading algorithm lib), `worker/`
(standalone scan loop), `shared/` (types — must be built first). `legacy/` is
reference-only. Standard commands live in the root `README.md` and `package.json`
scripts; only the non-obvious caveats are captured here.

### Build / lint / test (no external accounts needed)
- `shared` must be built before anything typechecks. `pnpm install` already runs its
  `prepare` (build) hook, and the update script runs `pnpm setup` as well.
- "Lint" here means `pnpm check:boundaries` (import-boundary script) + `pnpm typecheck`
  (whole workspace). There is no ESLint/Prettier configured.
- Tests: only `engine` has them — `pnpm --filter @autotrade/engine test` (Node test
  runner, 9 tests, no network). There is no Vitest/Jest.

### Running the app — Convex backend (required, runs locally, no account)
- Use Convex anonymous agent mode so no login/account is needed:
  `cd web && CONVEX_AGENT_MODE=anonymous npx convex dev`. It provisions a local
  deployment at `http://127.0.0.1:3210` and writes `CONVEX_DEPLOYMENT`,
  `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` into `web/.env.local`.
- `web/convex/auth.config.ts` throws unless `CLERK_JWT_ISSUER_DOMAIN` is set in the
  **Convex deployment env** (not `.env.local`). Functions will not deploy without it.
  Set deployment env vars with `cd web && CONVEX_AGENT_MODE=anonymous npx convex env set NAME value`.
  At minimum set: `CLERK_JWT_ISSUER_DOMAIN`, `BOT_INTERNAL_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `BROKER_ENCRYPTION_KEY`, `BILLING_ENABLED=false`. A placeholder issuer domain is fine
  to get functions to deploy; only real Clerk login needs a real one.
- Invoke backend functions directly (great for verifying without the UI), e.g.
  `CONVEX_AGENT_MODE=anonymous npx convex run users:syncFromClerk '{"clerkId":"x","email":"x@y.z","role":"USER"}'`
  and inspect tables with `CONVEX_AGENT_MODE=anonymous npx convex data <table>`.

### Running the app — Next.js web (`cd web && pnpm dev`, port 3000)
- GOTCHA: the entire app (including the public `/` landing page) is wrapped in Clerk's
  `<ClerkProvider>`, which validates the publishable key at render. With a placeholder
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` the server returns HTTP 500 "Publishable key not
  valid." The dev server still boots fine; you just can't render pages until real Clerk
  keys are present. Real `pk_test_`/`sk_test_` Clerk keys cannot be fabricated.
- To exercise the authed UI + paper trading you need (set in `web/.env.local`, and the
  Convex-dashboard ones also via `convex env set`): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `ALPACA_API_KEY`/`ALPACA_API_SECRET`
  (free paper keys, `MARKET_DATA_PROVIDER=alpaca`), and a matching real
  `CLERK_JWT_ISSUER_DOMAIN` in the Convex deployment env. Generate the local-only
  secrets with `pnpm env:secrets`; validate with `pnpm env:validate`.

### Other notes
- `.npmrc` uses `node-linker=hoisted` + `shamefully-hoist`; trusted build scripts are
  allowlisted in `pnpm-workspace.yaml` (`allowBuilds`), so installs are non-interactive.
- The worker (`pnpm dev:engine`) is optional — the Convex cron already drives the bot
  scan; the worker only adds real-time Alpaca streaming and needs Alpaca keys.
- Stripe billing is off by default (`BILLING_ENABLED=false`); Resend/Sentry/PostHog are
  optional and the app runs without them.
