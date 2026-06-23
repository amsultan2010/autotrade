# Legacy code (archived)

This folder is **not part of the pnpm workspace**. It is kept for reference only.

| Folder | What it was | Replaced by |
|--------|-------------|-------------|
| `desktop/` | Electron desktop client | `web/` (Next.js) |

The old Fastify + Postgres backend was removed after the Convex migration.

Do not develop new features here. Active work happens in the top-level `web/`, `engine/`, `worker/`, and `shared/` folders.
