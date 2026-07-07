/**
 * Shared Alpaca configuration: base URLs, auth headers, readiness check.
 * One key/secret pair works for market data, the WebSocket stream, AND the
 * trading (broker) API — which is why Alpaca covers data + paper + live.
 * Secrets live only in env (backend), never in the desktop client.
 */
import { env } from '../config/env';

export const ALPACA_DATA_BASE = 'https://data.alpaca.markets';

export function alpacaTradingBase(): string {
  return env.ALPACA_PAPER ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
}

export function alpacaStreamUrl(): string {
  return `wss://stream.data.alpaca.markets/v2/${env.ALPACA_FEED}`;
}

export function alpacaHeaders(): Record<string, string> {
  return {
    'APCA-API-KEY-ID': (env.ALPACA_API_KEY ?? '').trim(),
    'APCA-API-SECRET-KEY': (env.ALPACA_API_SECRET ?? '').trim(),
    Accept: 'application/json',
  };
}

export function isAlpacaConfigured(): boolean {
  return Boolean(env.ALPACA_API_KEY && env.ALPACA_API_SECRET);
}

/** Whether the US stock market is currently open (Alpaca clock, cached 30s).
 * Returns true when credentials are missing or the clock API fails — never block trading on auth errors. */
let clockCache: { open: boolean; ts: number } | null = null;

export async function isStockMarketOpen(
  credentials?: { keyId: string; secret: string; paper: boolean },
): Promise<boolean> {
  const keyId = (credentials?.keyId ?? env.ALPACA_API_KEY ?? '').trim();
  const secret = (credentials?.secret ?? env.ALPACA_API_SECRET ?? '').trim();
  if (!keyId || !secret) return true;

  if (!credentials && clockCache && Date.now() - clockCache.ts < 30_000) {
    return clockCache.open;
  }

  const paper = credentials?.paper ?? env.ALPACA_PAPER;
  const base = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const headers = {
    'APCA-API-KEY-ID': keyId,
    'APCA-API-SECRET-KEY': secret,
    Accept: 'application/json',
  };

  try {
    const res = await fetch(`${base}/v2/clock`, { headers });
    if (!res.ok) return clockCache?.open ?? true;
    const d = (await res.json()) as { is_open?: boolean };
    const open = Boolean(d.is_open);
    if (!credentials) clockCache = { open, ts: Date.now() };
    return open;
  } catch {
    return clockCache?.open ?? true;
  }
}
