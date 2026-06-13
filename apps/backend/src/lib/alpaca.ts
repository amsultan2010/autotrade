/**
 * Shared Alpaca configuration: base URLs, auth headers, readiness check.
 * One key/secret pair works for market data, the WebSocket stream, AND the
 * trading (broker) API — which is why Alpaca covers data + paper + live.
 * Secrets live only in env (backend), never in the desktop client.
 */
import { env } from '../config/env.js';

export const ALPACA_DATA_BASE = 'https://data.alpaca.markets';

export function alpacaTradingBase(): string {
  return env.ALPACA_PAPER ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
}

export function alpacaStreamUrl(): string {
  return `wss://stream.data.alpaca.markets/v2/${env.ALPACA_FEED}`;
}

export function alpacaHeaders(): Record<string, string> {
  return {
    'APCA-API-KEY-ID': env.ALPACA_API_KEY ?? '',
    'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET ?? '',
    Accept: 'application/json',
  };
}

export function isAlpacaConfigured(): boolean {
  return Boolean(env.ALPACA_API_KEY && env.ALPACA_API_SECRET);
}

/** Whether the US stock market is currently open (Alpaca clock, cached 30s).
 * Returns true when Alpaca isn't configured — we can't check, so don't block. */
let clockCache: { open: boolean; ts: number } | null = null;
export async function isStockMarketOpen(): Promise<boolean> {
  if (!isAlpacaConfigured()) return true;
  if (clockCache && Date.now() - clockCache.ts < 30_000) return clockCache.open;
  try {
    const res = await fetch(`${alpacaTradingBase()}/v2/clock`, { headers: alpacaHeaders() });
    if (!res.ok) return clockCache?.open ?? false;
    const d = (await res.json()) as { is_open?: boolean };
    clockCache = { open: Boolean(d.is_open), ts: Date.now() };
    return clockCache.open;
  } catch {
    return clockCache?.open ?? false;
  }
}
