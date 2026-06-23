# Autotrade

Personalized, subscription-gated AI trading bot. **Web app** (Next.js + Convex) with a separate **trading engine** package.

> **Coworking:** See [docs/COWORKING.md](docs/COWORKING.md) for branch workflow and ownership.

> Design source of truth: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repo layout

```
web/       Next.js website + Convex (Abdullah)
engine/    Trading algorithm + Prisma (Preston)
worker/    Background scan loop (Preston)
shared/    Cross-boundary types and DTOs (both)
legacy/    Archived backend + desktop (reference only)
```

## Prerequisites

- Node 20+ and pnpm 9+
- PostgreSQL (`DATABASE_URL` in env)
- Clerk, Convex, and market-data API keys (see `web/.env.example`)

## Quick start

```bash
pnpm install
pnpm setup          # build shared + generate Prisma client
pnpm dev:web        # Next.js at http://localhost:3000
```

For algorithm work:

```bash
pnpm dev:engine     # background scan loop
pnpm typecheck:engine
```

## Branch workflow

Branch from `main` with an area prefix:

- `web/feature-name` — website changes
- `engine/feature-name` — algorithm changes
- `shared/feature-name` — coordinated type changes

See [docs/COWORKING.md](docs/COWORKING.md) for the full guide.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm dev:engine` | Start worker scan loop |
| `pnpm typecheck:web` | Typecheck web only |
| `pnpm typecheck:engine` | Typecheck engine + worker |
| `pnpm check:boundaries` | Verify web/engine import rules |
| `pnpm setup` | Build shared + Prisma generate |

## Deploy

| Component | Target | Docs |
|-----------|--------|------|
| Web | Vercel (Root Directory: `web`) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Convex | `pnpm convex:deploy` in `web/` | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Worker | Railway / Fly / VPS | [docs/COWORKING.md](docs/COWORKING.md) |

## Security

- Secrets live server-side only (`web/.env.local`, Vercel env, Convex env).
- Subscription and role checks enforced server-side on every gated route.
- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full security model.
