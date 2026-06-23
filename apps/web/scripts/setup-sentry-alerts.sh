#!/usr/bin/env bash
# Creates Sentry issue alert rules that email on every new/regression issue.
# Requires SENTRY_AUTH_TOKEN in environment (from .env.local or Vercel).
set -euo pipefail

ORG="${SENTRY_ORG:-amsultan2010}"
PROJECT="${SENTRY_PROJECT:-javascript-nextjs}"
TOKEN="${SENTRY_AUTH_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "SENTRY_AUTH_TOKEN is required. Export it or add to apps/web/.env.local"
  exit 1
fi

API="https://sentry.io/api/0/projects/${ORG}/${PROJECT}/rules/"

create_rule() {
  local name="$1"
  local payload="$2"
  echo "Creating alert: ${name}"
  curl -sf -X POST "$API" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq -r '.id // .detail // .'
}

create_rule "Autotrade — email on new issues" '{
  "name": "Autotrade — email on new issues",
  "actionMatch": "all",
  "filterMatch": "all",
  "frequency": 30,
  "conditions": [
    { "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition" }
  ],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "IssueOwners",
      "fallthroughType": "ActiveMembers"
    }
  ]
}'

create_rule "Autotrade — email on regressions" '{
  "name": "Autotrade — email on regressions",
  "actionMatch": "all",
  "filterMatch": "all",
  "frequency": 30,
  "conditions": [
    { "id": "sentry.rules.conditions.regression_event.RegressionEventCondition" }
  ],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "IssueOwners",
      "fallthroughType": "ActiveMembers"
    }
  ]
}'

echo "Done. Verify at https://${ORG}.sentry.io/alerts/rules/"
