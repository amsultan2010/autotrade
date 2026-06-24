#!/usr/bin/env bash
# Push shared secrets from web/.env.local → Convex dashboard.
# NEVER run with localhost NEXT_PUBLIC_APP_URL against production Convex.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/web/.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "${NEXT_PUBLIC_APP_URL:-}" == *localhost* ]]; then
  echo "Refusing to sync: NEXT_PUBLIC_APP_URL is localhost ($NEXT_PUBLIC_APP_URL)."
  echo "Convex cron must call your production URL (e.g. https://tryautotrade.com)."
  echo "Set production values in the env file you pass, or run:"
  echo "  NEXT_PUBLIC_APP_URL=https://tryautotrade.com bash scripts/sync-shared-secrets.sh"
  exit 1
fi

cd "$ROOT/web"
for key in BOT_INTERNAL_SECRET BROKER_ENCRYPTION_KEY NEXT_PUBLIC_APP_URL BILLING_ENABLED FOUNDER_LIVE_EMAIL; do
  val="${!key:-}"
  if [[ -n "$val" ]]; then
    echo "Setting Convex $key"
    npx convex env set "$key" "$val"
  else
    echo "Skipping unset $key"
  fi
done

# Explicit defaults when omitted from the env file
if [[ -z "${BILLING_ENABLED:-}" ]]; then
  echo "Setting Convex BILLING_ENABLED=false (default)"
  npx convex env set BILLING_ENABLED false
fi
if [[ -z "${FOUNDER_LIVE_EMAIL:-}" ]]; then
  echo "Setting Convex FOUNDER_LIVE_EMAIL=abdullahmsultan1@gmail.com (default)"
  npx convex env set FOUNDER_LIVE_EMAIL abdullahmsultan1@gmail.com
fi

echo "Synced shared secrets to Convex"
