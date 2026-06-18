/**
 * Stooq implementation of MarketDataProvider.
 *
 * Why it exists: Stooq serves REAL historical market data over free CSV
 * endpoints with NO API KEY and NO ACCOUNT — ideal for zero-cost local dev so
 * the bot runs on real (not random) prices out of the box.
 *
 * Limitations (be honest): reliable coverage is DAILY candles. Intraday
 * timeframes return empty here, so the engine analyzes the daily timeframe.
 * For full multi-timeframe intraday + production, switch MARKET_DATA_PROVIDER
 * to a licensed API (Finnhub paid / Twelve Data / Alpaca). Not TradingView.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@autotrade/shared';
import { MarketDataError, type MarketDataProvider } from './types';

/** Stooq uses suffixes (.us, .de, .uk…). Default unsuffixed symbols to US. */
function toStooqSymbol(symbol: string): string {
  const s = symbol.trim().toLowerCase();
  return s.includes('.') ? s : `${s}.us`;
}

export class StooqProvider implements MarketDataProvider {
  readonly name = 'stooq';

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    // Stooq has no clean search API; return a best-effort normalized candidate
    // so symbols can be added. Candle data is what actually drives the bot.
    const raw = query.trim().toUpperCase();
    if (!raw) return [];
    const hasSuffix = raw.includes('.');
    const symbol = hasSuffix ? raw : raw;
    const exchange = hasSuffix ? raw.split('.')[1]! : 'US';
    return [{ symbol, name: `${symbol} (Stooq)`, exchange, mic: null }];
  }

  async getQuote(symbol: string): Promise<Quote> {
    const s = toStooqSymbol(symbol);
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new MarketDataError(`Stooq quote failed: ${res.status}`, 'stooq', res.status >= 500);
    const text = await res.text();
    // header: Symbol,Date,Time,Open,High,Low,Close,Volume
    const lines = text.trim().split('\n');
    const row = lines[1]?.split(',');
    if (!row || row.length < 7) throw new MarketDataError(`No quote for ${symbol}`, 'stooq');
    const close = Number(row[6]);
    if (!Number.isFinite(close) || close <= 0) throw new MarketDataError(`No quote for ${symbol}`, 'stooq');
    const ts = Date.parse(`${row[1]}T${row[2] ?? '00:00:00'}Z`);
    return { symbol, price: close, t: Number.isFinite(ts) ? ts : Date.now() };
  }

  async getCandles(symbol: string, timeframe: Timeframe, from: number, to: number): Promise<Candle[]> {
    // Only daily is reliably free on Stooq.
    if (timeframe !== '1d') return [];

    const s = toStooqSymbol(symbol);
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new MarketDataError(`Stooq candles failed: ${res.status}`, 'stooq', res.status >= 500);
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2 || !lines[0]!.startsWith('Date')) return [];

    const out: Candle[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, o, h, l, c, v] = lines[i]!.split(',');
      if (!date) continue;
      const t = Date.parse(`${date}T00:00:00Z`);
      const tsec = Math.floor(t / 1000);
      if (tsec < from || tsec > to) continue;
      const open = Number(o);
      const high = Number(h);
      const low = Number(l);
      const close = Number(c);
      if (![open, high, low, close].every(Number.isFinite)) continue;
      out.push({ t, o: open, h: high, l: low, c: close, v: Number(v) || 0 });
    }
    return out;
  }
}
