# Legacy code (archived)

This folder is **not part of the pnpm workspace**. It is kept for reference only.

| Folder | What it was | Replaced by |
|--------|-------------|-------------|
| `backend/` | Fastify API + embedded Postgres dev DB | `engine/` + `web/` API routes |
| `desktop/` | Electron desktop client | `web/` (Next.js) |

Do not develop new features here. Active work happens in the top-level `web/`, `engine/`, `worker/`, and `shared/` folders.
