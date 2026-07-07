#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/apps/web/.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from apps/web/.env.example"
  exit 1
fi
set -a
source "$ENV_FILE"
set +a
missing=()
require() { [[ -n "${!1:-}" ]] || missing+=("$1"); }
require NEXT_PUBLIC_SUPABASE_URL
require NEXT_PUBLIC_SUPABASE_ANON_KEY
require SUPABASE_SERVICE_ROLE_KEY
require NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
require CLERK_SECRET_KEY
require CLERK_WEBHOOK_SECRET
require BOT_INTERNAL_SECRET
require CRON_SECRET
require NEXT_PUBLIC_APP_URL
require MARKET_DATA_PROVIDER
require BROKER_ENCRYPTION_KEY
if [[ "${BILLING_ENABLED:-false}" == "true" ]]; then
  require STRIPE_SECRET_KEY
  require STRIPE_WEBHOOK_SECRET
fi
ZERO_KEY="0000000000000000000000000000000000000000000000000000000000000000"
if [[ "${BROKER_ENCRYPTION_KEY:-}" == "$ZERO_KEY" ]]; then
  echo "BROKER_ENCRYPTION_KEY must not be the all-zeros placeholder — generate with: openssl rand -hex 32"
  exit 1
fi
if ((${#missing[@]})); then
  echo "Missing:"; printf "  - %s\n" "${missing[@]}"; exit 1
fi
echo "Env validation passed ($ENV_FILE)"
