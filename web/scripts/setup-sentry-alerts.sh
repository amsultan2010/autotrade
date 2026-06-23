#!/usr/bin/env bash
# Creates/updates Sentry issue alert rules that email the org owner on errors.
# Requires SENTRY_AUTH_TOKEN in environment (from .env.local or Vercel).
set -euo pipefail

ORG="${SENTRY_ORG:-amsultan2010}"
PROJECT="${SENTRY_PROJECT:-javascript-nextjs}"
TOKEN="${SENTRY_AUTH_TOKEN:-}"
NOTIFY_EMAIL="${SENTRY_NOTIFY_EMAIL:-abdullahmsultan1@gmail.com}"

if [[ -z "$TOKEN" ]]; then
  echo "SENTRY_AUTH_TOKEN is required. Export it or add to web/.env.local"
  exit 1
fi

API_BASE="https://sentry.io/api/0"
RULES_API="${API_BASE}/projects/${ORG}/${PROJECT}/rules/"
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

resolve_member_id() {
  curl -sf "${API_BASE}/organizations/${ORG}/members/" \
    -H "${AUTH_HEADER}" \
    | jq -r --arg email "${NOTIFY_EMAIL}" '
        .[] | select(.user.email == $email) | .user.id
      ' | head -1
}

MEMBER_ID="${SENTRY_NOTIFY_USER_ID:-$(resolve_member_id)}"
if [[ -z "$MEMBER_ID" || "$MEMBER_ID" == "null" ]]; then
  echo "Could not resolve Sentry member ID for ${NOTIFY_EMAIL}. Set SENTRY_NOTIFY_USER_ID."
  exit 1
fi

echo "Using notify target: ${NOTIFY_EMAIL} (member ${MEMBER_ID})"

EMAIL_ACTION=$(jq -n \
  --arg id "$MEMBER_ID" \
  '{
    "id": "sentry.mail.actions.NotifyEmailAction",
    "targetType": "Member",
    "targetIdentifier": $id
  }')

find_rule_id() {
  local name="$1"
  curl -sf "${RULES_API}" -H "${AUTH_HEADER}" \
    | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' | head -1
}

upsert_rule() {
  local name="$1"
  local payload="$2"
  local existing
  existing="$(find_rule_id "$name" || true)"

  if [[ -n "$existing" && "$existing" != "null" ]]; then
    echo "Updating alert: ${name} (id ${existing})"
    curl -sf -X PUT "${RULES_API}${existing}/" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "$payload" | jq -r '.id // .detail // .'
  else
    echo "Creating alert: ${name}"
    curl -sf -X POST "${RULES_API}" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "$payload" | jq -r '.id // .detail // .'
  fi
}

upsert_rule "Autotrade — email on new issues" "$(jq -n \
  --argjson action "$EMAIL_ACTION" \
  '{
    "name": "Autotrade — email on new issues",
    "actionMatch": "all",
    "filterMatch": "all",
    "frequency": 30,
    "conditions": [
      { "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition" }
    ],
    "actions": [$action]
  }')"

upsert_rule "Autotrade — email on regressions" "$(jq -n \
  --argjson action "$EMAIL_ACTION" \
  '{
    "name": "Autotrade — email on regressions",
    "actionMatch": "all",
    "filterMatch": "all",
    "frequency": 30,
    "conditions": [
      { "id": "sentry.rules.conditions.regression_event.RegressionEventCondition" }
    ],
    "actions": [$action]
  }')"

upsert_rule "Autotrade — email on recurring errors" "$(jq -n \
  --argjson action "$EMAIL_ACTION" \
  '{
    "name": "Autotrade — email on recurring errors",
    "actionMatch": "all",
    "filterMatch": "all",
    "frequency": 30,
    "conditions": [
      {
        "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
        "value": 1,
        "interval": "15m",
        "comparisonType": "count"
      }
    ],
    "actions": [$action]
  }')"

upsert_rule "Autotrade — production errors" "$(jq -n \
  --argjson action "$EMAIL_ACTION" \
  '{
    "name": "Autotrade — production errors",
    "actionMatch": "all",
    "filterMatch": "all",
    "frequency": 30,
    "environment": "production",
    "conditions": [
      { "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition" },
      {
        "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
        "value": 1,
        "interval": "15m",
        "comparisonType": "count"
      }
    ],
    "actions": [$action]
  }')"

echo "Done. Verify at https://${ORG}.sentry.io/alerts/rules/?project=${PROJECT}"
