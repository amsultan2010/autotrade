import { getMarketData, liveEngine } from '@autotrade/engine/public';
import { marketDataForUser } from '@/lib/market-data-server';

export interface QuoteRow {
  symbol: string;
  price: number | null;
  changePct: number | null;
  live?: boolean;
}

const TTL_MS = 12_000;
const MAX_ENTRIES = 500;

type CacheEntry = { expires: number; quotes: Map<string, QuoteRow> };

const cache = new Map<string, CacheEntry>();

function cacheKey(clerkId: string, symbols: string[]): string {
  return `${clerkId}:${symbols.join(',')}`;
}

function pruneCache(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

async function fetchSnapshots(
  clerkId: string,
  symbols: string[],
): Promise<Record<string, { price: number; changePct: number | null }>> {
  let snapshots: Record<string, { price: number; changePct: number | null }> = {};
  try {
    const md = await marketDataForUser(clerkId);
    if (md.getSnapshots) snapshots = await md.getSnapshots(symbols);
  } catch {
    try {
      const md = getMarketData();
      if (md.getSnapshots) snapshots = await md.getSnapshots(symbols);
    } catch {
      /* degrade gracefully */
    }
  }
  return snapshots;
}

export async function getCachedQuotes(clerkId: string, symbols: string[]): Promise<QuoteRow[]> {
  const normalized = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort();
  if (normalized.length === 0) return [];

  const key = cacheKey(clerkId, normalized);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    return normalized.map(
      (sym) =>
        hit.quotes.get(sym) ?? {
          symbol: sym,
          price: liveEngine.priceOf(sym) ?? null,
          changePct: null,
          live: liveEngine.priceOf(sym) != null,
        },
    );
  }

  const snapshots = await fetchSnapshots(clerkId, normalized);
  const quotes = new Map<string, QuoteRow>();
  for (const sym of normalized) {
    const live = liveEngine.priceOf(sym);
    const snap = snapshots[sym];
    quotes.set(sym, {
      symbol: sym,
      price: live ?? snap?.price ?? null,
      changePct: snap?.changePct ?? null,
      live: live != null,
    });
  }

  cache.set(key, { expires: now + TTL_MS, quotes });
  pruneCache();

  return normalized.map((sym) => quotes.get(sym)!);
}
