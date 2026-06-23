#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/web/.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from web/.env.example"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
missing=()
require() { [[ -n "${!1:-}" ]] || missing+=("$1"); }
require NEXT_PUBLIC_CONVEX_URL
require NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
require CLERK_SECRET_KEY
require BOT_INTERNAL_SECRET
require NEXT_PUBLIC_APP_URL
require MARKET_DATA_PROVIDER
require ALPACA_API_KEY
require ALPACA_API_SECRET
require BROKER_ENCRYPTION_KEY
require CONVEX_URL
require JWT_ACCESS_SECRET
require JWT_REFRESH_SECRET
if [[ "${BILLING_ENABLED:-false}" == "true" ]]; then
  require STRIPE_SECRET_KEY
  require STRIPE_WEBHOOK_SECRET
  require STRIPE_PRICE_ID
fi
if ((${#missing[@]})); then
  echo "Missing required env vars:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi
echo "Env validation passed ($ENV_FILE)"
