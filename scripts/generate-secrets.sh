#!/usr/bin/env bash
set -euo pipefail
echo "BROKER_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "BOT_INTERNAL_SECRET=$(openssl rand -hex 32)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
