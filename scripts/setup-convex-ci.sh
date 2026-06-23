#!/usr/bin/env bash
# One-time setup: store a Convex production deploy key in GitHub Actions secrets
# so merges to main auto-deploy the Convex backend (see .github/workflows/deploy-convex.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"

ORG="${GITHUB_ORG:-amsultan2010}"
REPO="${GITHUB_REPO:-autotrade}"

echo "Convex CI deploy — one-time GitHub secret setup"
echo ""
echo "You need a Production Deploy Key from the Convex dashboard:"
echo "  1. Open https://dashboard.convex.dev → your project → Production deployment"
echo "  2. Settings → Deploy Keys → Generate Production Deploy Key → copy"
echo ""
echo "Or, if you are logged into the Convex CLI locally:"
echo "  cd web && npx convex deployment token create github-actions --prod"
echo ""

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI (gh), then run:"
  echo "  gh secret set CONVEX_DEPLOY_KEY --repo ${ORG}/${REPO}"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "Using CONVEX_DEPLOY_KEY from environment..."
  gh secret set CONVEX_DEPLOY_KEY --repo "${ORG}/${REPO}" --body "${CONVEX_DEPLOY_KEY}"
  echo "Done. CONVEX_DEPLOY_KEY saved to ${ORG}/${REPO}."
  exit 0
fi

echo "Paste your Production Deploy Key (input hidden), then press Enter:"
read -rs DEPLOY_KEY
echo ""
if [[ -z "$DEPLOY_KEY" ]]; then
  echo "No key entered."
  exit 1
fi

gh secret set CONVEX_DEPLOY_KEY --repo "${ORG}/${REPO}" --body "${DEPLOY_KEY}"
echo "Done. CONVEX_DEPLOY_KEY saved to ${ORG}/${REPO}."
echo ""
echo "From now on, pushes to main that touch web/convex/ will auto-deploy Convex."
echo "Vercel still auto-deploys the Next.js app on every main push."
