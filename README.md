# Autotrade

AI-powered automated trading platform with a premium skeuomorphic console UI.

## Stack

- **Web**: Next.js 15, Clerk, Supabase, Stripe, Resend, Sentry, PostHog
- **Worker**: Node always-on scheduler (2s tick default, per-user scan intervals)
- **Engine**: Strategy engine, Alpaca broker, paper simulator

## Monorepo

```
apps/web      Next.js app + API routes
apps/worker   Always-on bot scheduler (local or your VPS; Railway optional)
packages/engine   Trading domain
packages/shared   Plans, entitlements, DTOs
packages/db       Supabase clients
supabase/migrations
```

## Development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local  # fill in keys
pnpm --filter @autotrade/shared build
pnpm dev:web
pnpm dev:worker
```

## Deploy

- **Vercel**: root `apps/web`, build `cd ../.. && pnpm turbo build --filter=@autotrade/web`
- **Worker** (optional): `apps/worker` — local `pnpm dev:worker` or deploy to Render/Fly/VPS
- See [docs/SETUP.md](docs/SETUP.md) for the full connection checklist
- Apply `supabase/migrations` to your Supabase project

## License

Proprietary
