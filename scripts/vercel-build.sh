#!/usr/bin/env bash
# Build shared + Prisma client + Next.js app from the monorepo root.
# Invoked by web/vercel.json — same root resolution as vercel-install.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f pnpm-workspace.yaml ]]; then
  echo "error: expected monorepo root at ${ROOT} (pnpm-workspace.yaml missing)" >&2
  exit 1
fi

pnpm run build:vercel
