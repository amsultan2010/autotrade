/**
 * Market data service entrypoint. Selects a provider (default Finnhub) and
 * wraps it with caching + rate limiting. The rest of the app depends only on
 * `getMarketData()` returning a MarketDataProvider — never a concrete vendor.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@autotrade/shared';
import type { SymbolSnapshot } from './types';
import { env } from '../../config/env';
import { AlpacaProvider } from './alpaca.provider';
import { FinnhubProvider } from './finnhub.provider';
import { StooqProvider } from './stooq.provider';
import { TwelveDataProvider } from './twelvedata.provider';
import { RateLimiter, TtlCache } from './cache';
import { isAlpacaConfigured } from '../../lib/alpaca';
import { MarketDataError, type MarketDataProvider } from './types';
import * as db from '../../lib/supabase-db';

/** Per-provider request budget (requests per minute). */
const PROVIDER_RATE: Record<string, number> = {
  alpaca: 150, // free tier is 200/min
  finnhub: 50,
  twelvedata: 7, // free tier is 8/min
  stooq: 20,
};

class CachingMarketData implements MarketDataProvider {
  readonly name: string;
  private quoteCache = new TtlCache<Quote>(3_000); // 3s
  private candleCache = new TtlCache<Candle[]>(60_000); // 60s
  private searchCache = new TtlCache<SymbolSearchResult[]>(60_000);
  private limiter: RateLimiter;

  constructor(private readonly provider: MarketDataProvider) {
    this.name = provider.name;
    this.limiter = new RateLimiter(
      PROVIDER_RATE[provider.name] ?? PROVIDER_RATE[env.MARKET_DATA_PROVIDER] ?? 30,
      60_000,
    );
  }

  tryAcquireBudget(count: number): boolean {
    return this.limiter.tryAcquire(count);
  }

  rateLimitSnapshot() {
    return this.limiter.snapshot();
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const key = `s:${query.toLowerCase()}`;
    const hit = this.searchCache.get(key);
    if (hit) return hit;
    await this.limiter.acquire();
    const res = await this.provider.searchSymbols(query);
    this.searchCache.set(key, res);
    return res;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const hit = this.quoteCache.get(symbol);
    if (hit) return hit;
    await this.limiter.acquire();
    const q = await this.provider.getQuote(symbol);
    this.quoteCache.set(symbol, q);
    return q;
  }

  async getCandles(symbol: string, tf: Timeframe, from: number, to: number): Promise<Candle[]> {
    // Bucket the request time to a 60s window so repeated scans (every tick /
    // every 30s) within that window reuse cached candles instead of refetching.
    // The lookback per timeframe is constant, so `from` is intentionally not in
    // the key — otherwise the key changes every second and never hits.
    const key = `${symbol}:${tf}:${Math.floor(to / 60)}`;
    const hit = this.candleCache.get(key);
    if (hit) return hit;
    await this.limiter.acquire();
    const c = await this.provider.getCandles(symbol, tf, from, to);
    this.candleCache.set(key, c);
    return c;
  }

  async getSnapshots(symbols: string[]): Promise<Record<string, SymbolSnapshot>> {
    if (!this.provider.getSnapshots) {
      // Fallback: per-symbol quotes (price only, no change%).
      const out: Record<string, SymbolSnapshot> = {};
      await Promise.all(
        symbols.map(async (s) => {
          try {
            out[s] = { price: (await this.getQuote(s)).price, changePct: null };
          } catch {
            /* skip */
          }
        }),
      );
      return out;
    }
    await this.limiter.acquire();
    return this.provider.getSnapshots(symbols);
  }
}

let instance: MarketDataProvider | null = null;
const userInstances = new Map<string, MarketDataProvider>();

function wrapProvider(base: MarketDataProvider): MarketDataProvider {
  return new CachingMarketData(base);
}

function createBaseProvider(): MarketDataProvider {
  // Stooq cannot serve intraday candles; prefer Alpaca whenever keys are configured.
  if (isAlpacaConfigured() && env.MARKET_DATA_PROVIDER !== 'twelvedata' && env.MARKET_DATA_PROVIDER !== 'finnhub') {
    return new AlpacaProvider();
  }

  switch (env.MARKET_DATA_PROVIDER) {
    case 'alpaca':
      if (!isAlpacaConfigured()) {
        throw new MarketDataError('ALPACA_API_KEY and ALPACA_API_SECRET are required for the alpaca provider', 'alpaca');
      }
      return new AlpacaProvider();
    case 'twelvedata':
      if (!env.TWELVEDATA_API_KEY) {
        throw new MarketDataError('TWELVEDATA_API_KEY is required for the twelvedata provider', 'twelvedata');
      }
      return new TwelveDataProvider(env.TWELVEDATA_API_KEY);
    case 'finnhub':
      if (!env.FINNHUB_API_KEY) {
        throw new MarketDataError('FINNHUB_API_KEY is required for the finnhub provider', 'finnhub');
      }
      return new FinnhubProvider(env.FINNHUB_API_KEY);
    case 'stooq':
      return new StooqProvider();
    default:
      throw new MarketDataError(`Unknown provider: ${env.MARKET_DATA_PROVIDER}`, 'unknown');
  }
}

export function getMarketData(): MarketDataProvider {
  if (instance) return instance;
  instance = wrapProvider(createBaseProvider());
  return instance;
}

/**
 * Market data for a specific user. When Alpaca broker credentials are connected,
 * uses those keys so trading works even if server env keys are missing or stale.
 */
export async function getMarketDataForUser(clerkId: string): Promise<MarketDataProvider> {
  const cached = userInstances.get(clerkId);
  if (cached) return cached;

  try {
    const cred =
      (await db.getDecryptedBrokerKeys(clerkId, true)) ??
      (await db.getDecryptedBrokerKeys(clerkId, false));
    if (cred?.provider === 'alpaca') {
      const md = wrapProvider(
        new AlpacaProvider({ keyId: cred.keyId, secret: cred.secret, paper: cred.paper }),
      );
      userInstances.set(clerkId, md);
      return md;
    }
  } catch {
    /* fall back to global provider */
  }

  return getMarketData();
}

/** Drop cached per-user provider (e.g. after Alpaca 401). */
export function invalidateUserMarketData(clerkId: string): void {
  userInstances.delete(clerkId);
}

function isMarketDataAuthError(err: MarketDataError): boolean {
  return /\b(401|403)\b/.test(err.message);
}

/**
 * Fetch a quote for a user, falling back to the global provider when user
 * Alpaca keys are invalid or expired.
 */
export async function getQuoteForUser(clerkId: string, symbol: string): Promise<Quote> {
  try {
    const md = await getMarketDataForUser(clerkId);
    return await md.getQuote(symbol);
  } catch (err) {
    if (err instanceof MarketDataError && isMarketDataAuthError(err)) {
      invalidateUserMarketData(clerkId);
      return getMarketData().getQuote(symbol);
    }
    throw err;
  }
}

/** Whether the selected provider has what it needs to run (key, etc.). */
export function isMarketDataConfigured(): boolean {
  switch (env.MARKET_DATA_PROVIDER) {
    case 'alpaca':
      return isAlpacaConfigured();
    case 'twelvedata':
      return Boolean(env.TWELVEDATA_API_KEY);
    case 'finnhub':
      return Boolean(env.FINNHUB_API_KEY);
    case 'stooq':
      return true; // keyless, though currently anti-bot limited
    default:
      return false;
  }
}

export type { MarketDataProvider, MarketDataRateLimit } from './types';
export { MarketDataError } from './types';
