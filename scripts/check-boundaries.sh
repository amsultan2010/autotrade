#!/usr/bin/env bash
# Enforces import boundaries between web and engine packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

errors=0

# Web must only import @autotrade/engine/public, never engine internals.
if rg -l "from ['\"]@autotrade/engine['\"]" apps/web/ --glob '*.{ts,tsx}' 2>/dev/null; then
  echo "ERROR: apps/web/ imports @autotrade/engine root — use @autotrade/engine/public only"
  errors=$((errors + 1))
fi

if matches=$(rg "from ['\"]@autotrade/engine/" apps/web/ --glob '*.{ts,tsx}' 2>/dev/null | rg -v "/public['\"]" || true); then
  if [ -n "$matches" ]; then
    echo "ERROR: apps/web/ imports engine internals — use @autotrade/engine/public only"
    echo "$matches"
    errors=$((errors + 1))
  fi
fi

# Worker must not import web.
if rg -l "from ['\"]@autotrade/web" apps/worker/ packages/engine/ --glob '*.{ts,tsx}' 2>/dev/null; then
  echo "ERROR: engine/worker imports web package"
  errors=$((errors + 1))
fi

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "$errors boundary violation(s)."
  exit 1
fi

echo "Boundary check passed."
