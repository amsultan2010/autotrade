/**
 * Finnhub implementation of MarketDataProvider.
 * Global coverage, legal API. Requires FINNHUB_API_KEY (backend only).
 *
 * NOTE: candle history availability depends on your Finnhub plan. The code
 * targets the documented `/stock/candle` endpoint; if your plan returns
 * `no_data`/403, upgrade the plan or swap providers via the factory — the
 * engines are unaffected.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@autotrade/shared';
import { MarketDataError, type MarketDataProvider } from './types';

const BASE = 'https://finnhub.io/api/v1';

const RESOLUTION: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D',
};

interface FinnhubCandleResp {
  s: string; // "ok" | "no_data"
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
}

interface FinnhubQuoteResp {
  c: number; // current
  t: number; // unix seconds
}

interface FinnhubSearchResp {
  result: Array<{ symbol: string; description: string; displaySymbol: string; type: string }>;
}

export class FinnhubProvider implements MarketDataProvider {
  readonly name = 'finnhub';

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new MarketDataError('FINNHUB_API_KEY is not set', 'finnhub');
  }

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set('token', this.apiKey);

    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 429) throw new MarketDataError('Finnhub rate limit', 'finnhub', true);
    if (!res.ok) {
      throw new MarketDataError(`Finnhub ${path} failed: ${res.status}`, 'finnhub', res.status >= 500);
    }
    return (await res.json()) as T;
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const data = await this.get<FinnhubSearchResp>('/search', { q: query });
    return (data.result ?? [])
      .filter((r) => r.type === 'Common Stock' || r.type === '' || r.type === 'ETP')
      .map((r) => {
        const [sym, mic] = r.symbol.includes('.')
          ? [r.symbol, r.symbol.split('.')[1] ?? null]
          : [r.symbol, null];
        return { symbol: sym, name: r.description, exchange: mic ?? 'US', mic };
      });
  }

  async getQuote(symbol: string): Promise<Quote> {
    const data = await this.get<FinnhubQuoteResp>('/quote', { symbol });
    if (!data || typeof data.c !== 'number' || data.c === 0) {
      throw new MarketDataError(`No quote for ${symbol}`, 'finnhub');
    }
    return { symbol, price: data.c, t: (data.t || Math.floor(Date.now() / 1000)) * 1000 };
  }

  async getCandles(symbol: string, timeframe: Timeframe, from: number, to: number): Promise<Candle[]> {
    const data = await this.get<FinnhubCandleResp>('/stock/candle', {
      symbol,
      resolution: RESOLUTION[timeframe],
      from,
      to,
    });
    if (data.s !== 'ok' || !data.t || !data.o || !data.h || !data.l || !data.c) {
      return [];
    }
    const out: Candle[] = [];
    for (let i = 0; i < data.t.length; i++) {
      out.push({
        t: data.t[i]! * 1000,
        o: data.o[i]!,
        h: data.h[i]!,
        l: data.l[i]!,
        c: data.c[i]!,
        v: data.v?.[i] ?? 0,
      });
    }
    return out;
  }
}
