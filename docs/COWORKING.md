# Coworking guide

Two developers work in parallel on separate feature branches. Each person owns a top-level folder — no more digging through `apps/` vs `packages/`.

## Repo layout

```
web/       Abdullah — Next.js website + Convex
engine/    Preston — trading algorithm + Prisma
worker/    Preston — background scan loop (deploys separately)
shared/    Both — types, DTOs, error codes (coordinate changes)
legacy/    Archived backend + desktop (not in workspace)
```

## Branch workflow

Always branch from latest `main`. Use a prefix that matches your area:

| Prefix | Who | Example |
|--------|-----|---------|
| `web/` | Abdullah | `web/watchlist-redesign` |
| `engine/` | Preston | `engine/momentum-strategy-v2` |
| `shared/` | Both (pair on it) | `shared/add-signal-status-enum` |

```bash
git checkout main && git pull
git checkout -b web/my-feature    # or engine/my-feature
# ... work only in your folder ...
pnpm typecheck:web                # or pnpm typecheck:engine
git push -u origin web/my-feature
# open PR → merge to main
```

**Rules to avoid conflicts:**

1. Stay in your folder. Abdullah edits `web/`, Preston edits `engine/` and `worker/`.
2. Never edit the other person's folder on the same branch.
3. `shared/` changes need both reviewers — they trigger full CI for everyone.
4. Preston exposes new server APIs only through `engine/src/public/index.ts`.
5. Abdullah imports engine only via `@autotrade/engine/public` in API routes.

## Ownership

| Area | Path | Owner | Deploy |
|------|------|-------|--------|
| Web | `web/` | @amsultan2010 | Vercel |
| Engine | `engine/` | @preston-inter | — |
| Worker | `worker/` | @preston-inter | Railway / Fly / VPS |
| Shared | `shared/` | Both | npm workspace |

GitHub CODEOWNERS auto-requests the right reviewer on PRs.

## Package boundaries

### `web/` (Next.js + Convex)

- **UI types**: `@autotrade/shared`
- **Server ops** (API routes): `@autotrade/engine/public` only
- **Never** import `@autotrade/engine` root or deep paths

### `engine/` (trading algorithm)

- All strategy, market data, Prisma, execution logic lives here.
- Export web-facing APIs through `src/public/index.ts`.
- Refactor freely inside `src/` outside `public/`.

### `worker/` (scan loop)

- Thin process: imports full `@autotrade/engine`.
- Deploy independently from web.

### `shared/` (contract layer)

- DTOs, enums, entitlements both sides compile against.
- Any change here runs **full typecheck** in CI.

## Daily commands

### Abdullah — website only

```bash
pnpm install
pnpm setup
pnpm dev:web
```

Work in `web/`. No need to run the worker.

### Preston — algorithm only

```bash
pnpm install
pnpm setup
pnpm typecheck:engine
pnpm dev:engine
```

Refactor freely in `engine/src/` (outside `public/`).

### Shared type change

1. Branch: `shared/descriptive-name`
2. Update `shared/`, then `pnpm typecheck` at root
3. Both owners review the PR before merge

## CI

Path-filtered checks on every PR to `main`:

| Changed paths | CI runs |
|---------------|---------|
| `web/**` | `typecheck:web` + boundary check |
| `engine/**` or `worker/**` | `typecheck:engine` + boundary check |
| `shared/**` or lockfile | Full `typecheck` |
| Always | `scripts/check-boundaries.sh` |

Run locally: `pnpm check:boundaries`
