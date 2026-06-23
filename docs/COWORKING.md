# Coworking guide

This monorepo is split so two developers can work in parallel without stepping on each other.

## Ownership

| Area | Paths | Owner | Deploy target |
|------|-------|-------|---------------|
| **Web** | `apps/web/` | User A (website) | Vercel |
| **Engine** | `packages/engine/` | User B (algorithm) | — |
| **Worker** | `apps/worker/` | User B (scan loop) | Railway / Fly / VPS |
| **Shared contract** | `packages/shared/` | Both (coordinate) | npm workspace |
| **Legacy** | `apps/backend/`, `apps/desktop/` | As needed | — |

Update `.github/CODEOWNERS` with both GitHub usernames.

## Package boundaries

### `apps/web` (Next.js + Convex)

- **Types**: import from `@autotrade/shared` only.
- **Server operations** (API routes, cron): import from `@autotrade/engine/public` only.
- **Never** import `@autotrade/engine` root or deep paths (`@autotrade/engine/src/...`).

The `/public` entry is the stable surface. Engine internals can change freely; web builds should not break as long as `/public` stays compatible.

### `packages/engine` (trading algorithm)

- All strategy, market data, Prisma, and execution logic lives here.
- Export new web-facing APIs through `src/public/index.ts` — do not expect web to import internals.
- Breaking changes to `/public` require coordinating with User A.

### `apps/worker` (background scan loop)

- Depends only on `@autotrade/engine` (full) and `@autotrade/shared`.
- Deploy independently from web. Algorithm changes ship via worker redeploy, not Vercel.

### `packages/shared` (cross-boundary contract)

- DTOs, enums, error codes, entitlements — anything both web UI and engine need at compile time.
- Changes here trigger **full CI** (web + engine + worker) because both sides depend on it.

## Typical workflows

### User A — website only (ignore engine for a week)

```bash
pnpm install
pnpm --filter @autotrade/shared build
pnpm --filter @autotrade/web dev
```

Work in `apps/web/` and `packages/shared/` (types only, with care). No need to run the worker or touch `packages/engine/`.

### User B — algorithm only

```bash
pnpm install
pnpm db:generate
pnpm --filter @autotrade/engine typecheck
pnpm dev:worker
```

Refactor freely inside `packages/engine/src/` (outside `public/`). Add or adjust `/public` exports only when web needs new server capabilities.

### Shared type change

1. Update `packages/shared`.
2. Run `pnpm typecheck` at root (or let CI run full matrix).
3. Both developers pull before merging.

## CI path filters

`.github/workflows/ci.yml` runs scoped checks:

- `apps/web/**` → web typecheck
- `packages/engine/**` or `apps/worker/**` → engine + worker typecheck
- `packages/shared/**` or root lockfile → full typecheck

## Future decoupling

- Move admin/legacy Prisma routes behind thin wrappers in `/public` (or Convex mutations).
- Consider HTTP boundary between web and engine if teams fully diverge.
- `AppError` in engine vs `TrackedError` in shared — align over time for client consistency.
