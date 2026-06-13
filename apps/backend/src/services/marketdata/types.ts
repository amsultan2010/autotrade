/**
 * Market data provider abstraction (req #4, #16). Swap implementations
 * (Finnhub / Polygon / Alpaca / Twelve Data) without touching the engines.
 * No provider scrapes TradingView.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@alphabot/shared';

export interface MarketDataProvider {
  readonly name: string;

  /** Search symbols across exchanges (global where the provider supports it). */
  searchSymbols(query: string): Promise<SymbolSearchResult[]>;

  /** Latest (real or delayed) quote for a symbol. */
  getQuote(symbol: string): Promise<Quote>;

  /**
   * Historical OHLCV candles for a timeframe.
   * @param from epoch seconds (inclusive)
   * @param to   epoch seconds (inclusive)
   */
  getCandles(symbol: string, timeframe: Timeframe, from: number, to: number): Promise<Candle[]>;

  /**
   * Optional batch snapshot (price + intraday % change) for many symbols in one
   * call — used to render real-time watchlist prices efficiently.
   */
  getSnapshots?(symbols: string[]): Promise<Record<string, SymbolSnapshot>>;
}

export interface SymbolSnapshot {
  price: number;
  changePct: number | null;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}
