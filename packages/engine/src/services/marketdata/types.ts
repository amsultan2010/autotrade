/**
 * Market data provider abstraction (req #4, #16). Swap implementations
 * (Finnhub / Polygon / Alpaca / Twelve Data) without touching the engines.
 * No provider scrapes TradingView.
 */
import type { Candle, Quote, SymbolSearchResult, Timeframe } from '@autotrade/shared';

export interface MarketDataRateLimit {
  remaining: number;
  capacity: number;
  intervalMs: number;
}

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

  /** Optional: non-blocking budget check for scan loops (token bucket). */
  tryAcquireBudget?(count: number): boolean;

  /** Optional: current rate-limit bucket snapshot. */
  rateLimitSnapshot?(): MarketDataRateLimit;

  /** Optional richer snapshots (bid/ask spread, 24h volume) when the provider supports them. */
  getExtendedSnapshots?(symbols: string[]): Promise<Record<string, ExtendedSymbolSnapshot>>;
}

export interface SymbolSnapshot {
  price: number;
  changePct: number | null;
}
/** Rich snapshot with optional microstructure fields (Alpaca crypto/stocks). */
export interface ExtendedSymbolSnapshot extends SymbolSnapshot {
  bid?: number;
  ask?: number;
  spreadPct?: number;
  volume24hUsd?: number;
  relativeVolume?: number;
  depthUsdNearTouch?: number;
  slippageEstPct?: number;
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
