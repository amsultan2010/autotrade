#!/usr/bin/env bash
# Install all workspace packages from the monorepo root.
# Invoked by web/vercel.json — resolves repo root from this script's path (no cd .. guessing).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f pnpm-workspace.yaml ]]; then
  echo "error: expected monorepo root at ${ROOT} (pnpm-workspace.yaml missing)" >&2
  exit 1
fi

corepack enable
pnpm install --frozen-lockfile
