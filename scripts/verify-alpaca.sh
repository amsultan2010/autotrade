#!/usr/bin/env bash
# Verify Alpaca paper and live trading API connectivity.
# Usage: bash scripts/verify-alpaca.sh [path-to-env-file]
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

KEY="${ALPACA_API_KEY:-}"
SECRET="${ALPACA_API_SECRET:-}"
KEY="$(echo -n "$KEY" | tr -d '[:space:]')"
SECRET="$(echo -n "$SECRET" | tr -d '[:space:]')"

if [[ -z "$KEY" || -z "$SECRET" ]]; then
  echo "FAIL: ALPACA_API_KEY and ALPACA_API_SECRET must be set in $ENV_FILE"
  exit 1
fi

node --input-type=module <<'NODE'
const key = process.env.ALPACA_API_KEY?.trim() ?? '';
const secret = process.env.ALPACA_API_SECRET?.trim() ?? '';

if (!key || !secret) {
  console.error('FAIL: missing Alpaca credentials');
  process.exit(1);
}

async function probe(label, base) {
  const headers = {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    Accept: 'application/json',
  };
  const endpoints = [
    ['account', '/v2/account'],
    ['clock', '/v2/clock'],
    ['positions', '/v2/positions'],
  ];
  const results = {};
  let ok = true;
  for (const [name, path] of endpoints) {
    try {
      const res = await fetch(base + path, { headers, signal: AbortSignal.timeout(12_000) });
      const body = await res.text();
      let parsed = body;
      try { parsed = JSON.stringify(JSON.parse(body)); } catch { /* keep text */ }
      results[name] = { status: res.status, ok: res.ok, body: String(parsed).slice(0, 160) };
      if (!res.ok) ok = false;
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
      ok = false;
    }
  }
  return { label, ok, results };
}

async function probeData() {
  const headers = {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    Accept: 'application/json',
  };
  try {
    const res = await fetch(
      'https://data.alpaca.markets/v2/stocks/AAPL/quotes/latest?feed=iex',
      { headers, signal: AbortSignal.timeout(12_000) },
    );
    const body = await res.text();
    return { label: 'DATA', ok: res.ok, status: res.status, body: body.slice(0, 160) };
  } catch (err) {
    return { label: 'DATA', ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const paper = await probe('PAPER', 'https://paper-api.alpaca.markets');
const live = await probe('LIVE', 'https://api.alpaca.markets');
const data = await probeData();

let exitCode = 0;
for (const r of [paper, live, data]) {
  const status = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) exitCode = 1;
  console.log(`\n[${status}] ${r.label}`);
  console.log(JSON.stringify(r, null, 2));
}

if (exitCode === 0) {
  console.log('\nAll Alpaca endpoints reachable with configured credentials.');
} else {
  console.error('\nAlpaca verification failed. Regenerate keys at https://app.alpaca.markets/');
  console.error('Paper keys only work on paper-api.alpaca.markets; live keys on api.alpaca.markets.');
}
process.exit(exitCode);
NODE
