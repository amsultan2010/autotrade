/**
 * Alpaca REST market data provider. Handles BOTH:
 *   - US equities  → /v2/stocks/...        (IEX feed, market hours)
 *   - crypto       → /v1beta3/crypto/us/... (24/7, BTC/USD style symbols)
 * Symbols containing "/" are treated as crypto and routed to the crypto feed.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@autotrade/shared';
import { env } from '../../config/env';
import { ALPACA_DATA_BASE } from '../../lib/alpaca';
import { MarketDataError, type MarketDataProvider, type SymbolSnapshot, type ExtendedSymbolSnapshot } from './types';

const TIMEFRAME: Record<Timeframe, string> = {
  '1m': '1Min',
  '5m': '5Min',
  '15m': '15Min',
  '1h': '1Hour',
  '1d': '1Day',
};

const CRYPTO_BASE = `${ALPACA_DATA_BASE}/v1beta3/crypto/us`;

/** Crypto symbols look like "BTC/USD". */
export function isCryptoSymbol(symbol: string): boolean {
  return symbol.includes('/');
}

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
interface AlpacaAsset {
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
  status: string;
  class: string;
}

export class AlpacaProvider implements MarketDataProvider {
  readonly name = 'alpaca';
  private assetsCache: AlpacaAsset[] | null = null;
  private assetsFetchedAt = 0;
  private readonly headers: Record<string, string>;
  private readonly tradingBase: string;

  constructor(credentials?: { keyId: string; secret: string; paper?: boolean }) {
    const keyId = (credentials?.keyId ?? env.ALPACA_API_KEY ?? '').trim();
    const secret = (credentials?.secret ?? env.ALPACA_API_SECRET ?? '').trim();
    if (!keyId || !secret) {
      throw new MarketDataError('ALPACA_API_KEY / ALPACA_API_SECRET are not set', 'alpaca');
    }
    this.headers = {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secret,
      Accept: 'application/json',
    };
    const paper = credentials?.paper ?? env.ALPACA_PAPER;
    this.tradingBase = paper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: this.headers, signal: AbortSignal.timeout(10_000) });
    if (res.status === 429) throw new MarketDataError('Alpaca rate limit', 'alpaca', true);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new MarketDataError(`Alpaca ${res.status}: ${body.slice(0, 200)}`, 'alpaca', res.status >= 500);
    }
    return (await res.json()) as T;
  }

  private async loadAssets(): Promise<AlpacaAsset[]> {
    const ONE_DAY = 86_400_000;
    if (this.assetsCache && Date.now() - this.assetsFetchedAt < ONE_DAY) return this.assetsCache;
    const base = this.tradingBase;
    const [equities, crypto] = await Promise.all([
      this.getJson<AlpacaAsset[]>(`${base}/v2/assets?status=active&asset_class=us_equity`),
      this.getJson<AlpacaAsset[]>(`${base}/v2/assets?status=active&asset_class=crypto`).catch(() => []),
    ]);
    this.assetsCache = [...equities.filter((a) => a.tradable), ...crypto.filter((a) => a.tradable)];
    this.assetsFetchedAt = Date.now();
    return this.assetsCache;
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const assets = await this.loadAssets();
    const starts: SymbolSearchResult[] = [];
    const contains: SymbolSearchResult[] = [];
    for (const a of assets) {
      const sym = a.symbol.toUpperCase();
      if (sym === q || sym.startsWith(q)) {
        starts.push({ symbol: a.symbol, name: a.name, exchange: a.exchange, mic: null });
      } else if (a.name?.toUpperCase().includes(q)) {
        contains.push({ symbol: a.symbol, name: a.name, exchange: a.exchange, mic: null });
      }
      if (starts.length >= 15) break;
    }
    return [...starts, ...contains].slice(0, 15);
  }

  async getQuote(symbol: string): Promise<Quote> {
    if (isCryptoSymbol(symbol)) {
      const url = `${CRYPTO_BASE}/latest/trades?symbols=${encodeURIComponent(symbol)}`;
      const data = await this.getJson<{ trades?: Record<string, { p: number; t: string }> }>(url);
      const tr = data.trades?.[symbol];
      if (!tr || tr.p <= 0) throw new MarketDataError(`No quote for ${symbol}`, 'alpaca');
      return { symbol, price: tr.p, t: tr.t ? Date.parse(tr.t) : Date.now() };
    }
    const url = `${ALPACA_DATA_BASE}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=${env.ALPACA_FEED}`;
    const data = await this.getJson<{ trade?: { p: number; t: string } }>(url);
    const p = data.trade?.p;
    if (typeof p !== 'number' || p <= 0) throw new MarketDataError(`No quote for ${symbol}`, 'alpaca');
    return { symbol, price: p, t: data.trade?.t ? Date.parse(data.trade.t) : Date.now() };
  }

  async getCandles(symbol: string, timeframe: Timeframe, from: number, to: number): Promise<Candle[]> {
    const start = new Date(from * 1000).toISOString();
    const end = new Date(to * 1000).toISOString();
    const tf = TIMEFRAME[timeframe];

    if (isCryptoSymbol(symbol)) {
      const url =
        `${CRYPTO_BASE}/bars?symbols=${encodeURIComponent(symbol)}` +
        `&timeframe=${tf}&start=${start}&end=${end}&limit=1000`;
      const data = await this.getJson<{ bars?: Record<string, AlpacaBar[]> }>(url);
      const arr = data.bars?.[symbol] ?? [];
      return arr.map((b) => ({ t: Date.parse(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
    }

    const url =
      `${ALPACA_DATA_BASE}/v2/stocks/${encodeURIComponent(symbol)}/bars` +
      `?timeframe=${tf}&start=${start}&end=${end}&limit=1000&adjustment=raw&feed=${env.ALPACA_FEED}`;
    const data = await this.getJson<{ bars?: AlpacaBar[] }>(url);
    if (!data.bars) return [];
    return data.bars.map((b) => ({ t: Date.parse(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
  }

  async getSnapshots(symbols: string[]): Promise<Record<string, SymbolSnapshot>> {
    if (symbols.length === 0) return {};
    const out: Record<string, SymbolSnapshot> = {};
    const stockSyms = symbols.filter((s) => !isCryptoSymbol(s));
    const cryptoSyms = symbols.filter(isCryptoSymbol);

    const fromSnap = (snap: { latestTrade?: { p: number }; dailyBar?: { c: number }; prevDailyBar?: { c: number } }) => {
      const price = snap.latestTrade?.p ?? snap.dailyBar?.c;
      if (typeof price !== 'number') return null;
      const prev = snap.prevDailyBar?.c;
      const changePct = prev && prev > 0 ? Number((((price - prev) / prev) * 100).toFixed(2)) : null;
      return { price, changePct } satisfies SymbolSnapshot;
    };

    if (stockSyms.length > 0) {
      const url =
        `${ALPACA_DATA_BASE}/v2/stocks/snapshots` +
        `?symbols=${stockSyms.map(encodeURIComponent).join(',')}&feed=${env.ALPACA_FEED}`;
      const data = await this.getJson<Record<string, Parameters<typeof fromSnap>[0]>>(url);
      for (const [sym, snap] of Object.entries(data)) {
        const s = fromSnap(snap);
        if (s) out[sym] = s;
      }
    }

    if (cryptoSyms.length > 0) {
      const url = `${CRYPTO_BASE}/snapshots?symbols=${cryptoSyms.map(encodeURIComponent).join(',')}`;
      const data = await this.getJson<{ snapshots?: Record<string, Parameters<typeof fromSnap>[0]> }>(url);
      for (const [sym, snap] of Object.entries(data.snapshots ?? {})) {
        const s = fromSnap(snap);
        if (s) out[sym] = s;
      }
    }

    return out;
  }

  async getExtendedSnapshots(symbols: string[]): Promise<Record<string, ExtendedSymbolSnapshot>> {
    if (symbols.length === 0) return {};
    const out: Record<string, ExtendedSymbolSnapshot> = {};
    const stockSyms = symbols.filter((s) => !isCryptoSymbol(s));
    const cryptoSyms = symbols.filter(isCryptoSymbol);

    type StockSnap = {
      latestTrade?: { p: number };
      latestQuote?: { ap: number; bp: number; apx?: number; bpx?: number };
      dailyBar?: { c: number; v: number };
      prevDailyBar?: { c: number; v: number };
    };

    const fromStockSnap = (snap: StockSnap): ExtendedSymbolSnapshot | null => {
      const price = snap.latestTrade?.p ?? snap.dailyBar?.c;
      if (typeof price !== 'number') return null;
      const prev = snap.prevDailyBar?.c;
      const changePct = prev && prev > 0 ? Number((((price - prev) / prev) * 100).toFixed(2)) : null;
      const ap = snap.latestQuote?.ap;
      const bp = snap.latestQuote?.bp;
      const spreadPct =
        ap != null && bp != null && bp > 0 ? Number((((ap - bp) / bp) * 100).toFixed(3)) : undefined;
      const volume24hUsd =
        snap.dailyBar?.v != null && snap.dailyBar.c > 0
          ? snap.dailyBar.v * snap.dailyBar.c
          : undefined;
      return { price, changePct, bid: bp, ask: ap, spreadPct, volume24hUsd };
    };

    if (stockSyms.length > 0) {
      const url =
        `${ALPACA_DATA_BASE}/v2/stocks/snapshots` +
        `?symbols=${stockSyms.map(encodeURIComponent).join(',')}&feed=${env.ALPACA_FEED}`;
      const data = await this.getJson<Record<string, StockSnap>>(url);
      for (const [sym, snap] of Object.entries(data)) {
        const s = fromStockSnap(snap);
        if (s) out[sym] = s;
      }
    }

    if (cryptoSyms.length > 0) {
      const url = `${CRYPTO_BASE}/snapshots?symbols=${cryptoSyms.map(encodeURIComponent).join(',')}`;
      const data = await this.getJson<{ snapshots?: Record<string, StockSnap> }>(url);
      for (const [sym, snap] of Object.entries(data.snapshots ?? {})) {
        const s = fromStockSnap(snap);
        if (s) out[sym] = s;
      }
    }

    return out;
  }
}
