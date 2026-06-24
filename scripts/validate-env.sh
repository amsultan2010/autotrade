#!/usr/bin/env bash
# Validate Vercel / local env file for required bot + auth + market data vars.
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
warns=()
require() { [[ -n "${!1:-}" ]] || missing+=("$1"); }

require NEXT_PUBLIC_CONVEX_URL
require NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
require CLERK_SECRET_KEY
require CLERK_WEBHOOK_SECRET
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

if [[ "${MARKET_DATA_PROVIDER:-}" != "alpaca" ]]; then
  warns+=("MARKET_DATA_PROVIDER is '${MARKET_DATA_PROVIDER:-unset}' — set to 'alpaca' for intraday candles")
fi

if [[ -n "${BROKER_ENCRYPTION_KEY:-}" && ${#BROKER_ENCRYPTION_KEY} -ne 64 ]]; then
  warns+=("BROKER_ENCRYPTION_KEY should be 64 hex chars (openssl rand -hex 32)")
fi

if [[ -n "${BOT_INTERNAL_SECRET:-}" && ${#BOT_INTERNAL_SECRET} -lt 32 ]]; then
  warns+=("BOT_INTERNAL_SECRET looks too short — use: openssl rand -hex 32")
fi

if [[ -n "${CONVEX_URL:-}" && -n "${NEXT_PUBLIC_CONVEX_URL:-}" && "${CONVEX_URL}" != "${NEXT_PUBLIC_CONVEX_URL}" ]]; then
  warns+=("CONVEX_URL differs from NEXT_PUBLIC_CONVEX_URL — they should match")
fi

if ((${#missing[@]})); then
  echo "Missing required env vars:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

if ((${#warns[@]})); then
  echo "Warnings:"
  printf '  - %s\n' "${warns[@]}"
fi

echo "Env validation passed ($ENV_FILE)"
