#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/web/.env.local}"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
cd "$ROOT/web"
for key in BOT_INTERNAL_SECRET BROKER_ENCRYPTION_KEY NEXT_PUBLIC_APP_URL BILLING_ENABLED FOUNDER_LIVE_EMAIL; do
  val="${!key:-}"
  if [[ -n "$val" ]]; then
    npx convex env set "$key" "$val"
  fi
done
echo "Synced shared secrets to Convex"
