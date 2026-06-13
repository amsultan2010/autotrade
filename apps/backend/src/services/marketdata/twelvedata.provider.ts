/**
 * Twelve Data implementation of MarketDataProvider.
 *
 * Real, legal API with a usable FREE tier (8 req/min, 800/day) that — unlike
 * keyless sources — provides genuine MULTI-TIMEFRAME intraday + daily candles,
 * symbol search, and quotes. Get a free key at https://twelvedata.com (no card).
 * Put it in TWELVEDATA_API_KEY. Not TradingView.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@autotrade/shared';
import { MarketDataError, type MarketDataProvider } from './types.js';

const BASE = 'https://api.twelvedata.com';

const INTERVAL: Record<Timeframe, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '1d': '1day',
};

interface TdValues {
  status?: string;
  code?: number;
  message?: string;
  values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
}

function parseTs(datetime: string): number {
  // "2024-01-02" or "2024-01-02 09:30:00" → ms. Treated as UTC (approx is fine).
  const iso = datetime.includes(' ') ? datetime.replace(' ', 'T') + 'Z' : datetime + 'T00:00:00Z';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelvedata';

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new MarketDataError('TWELVEDATA_API_KEY is not set', 'twelvedata');
  }

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set('apikey', this.apiKey);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 429) throw new MarketDataError('Twelve Data rate limit', 'twelvedata', true);
    if (!res.ok) throw new MarketDataError(`Twelve Data ${path}: ${res.status}`, 'twelvedata', res.status >= 500);
    return (await res.json()) as T;
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const data = await this.get<{ data?: Array<{ symbol: string; instrument_name: string; exchange: string; mic_code?: string }> }>(
      '/symbol_search',
      { symbol: query, outputsize: 15 },
    );
    return (data.data ?? []).map((r) => ({
      symbol: r.symbol,
      name: r.instrument_name,
      exchange: r.exchange,
      mic: r.mic_code ?? null,
    }));
  }

  async getQuote(symbol: string): Promise<Quote> {
    const data = await this.get<{ price?: string; code?: number; message?: string }>('/price', { symbol });
    const price = Number(data.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new MarketDataError(data.message ?? `No quote for ${symbol}`, 'twelvedata');
    }
    return { symbol, price, t: Date.now() };
  }

  async getCandles(symbol: string, timeframe: Timeframe, from: number, to: number): Promise<Candle[]> {
    const data = await this.get<TdValues>('/time_series', {
      symbol,
      interval: INTERVAL[timeframe],
      outputsize: 300,
      order: 'ASC',
    });
    if (data.status === 'error' || !data.values) {
      // Free tier may not include a symbol/interval; degrade to empty, don't crash.
      return [];
    }
    const out: Candle[] = [];
    for (const v of data.values) {
      const t = parseTs(v.datetime);
      const tsec = Math.floor(t / 1000);
      if (tsec < from || tsec > to) continue;
      const o = Number(v.open);
      const h = Number(v.high);
      const l = Number(v.low);
      const c = Number(v.close);
      if (![o, h, l, c].every(Number.isFinite)) continue;
      out.push({ t, o, h, l, c, v: Number(v.volume) || 0 });
    }
    return out;
  }
}
