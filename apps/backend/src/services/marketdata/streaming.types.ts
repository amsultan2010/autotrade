/**
 * Streaming market-data abstraction (real-time, push-based). Distinct from the
 * REST MarketDataProvider: this maintains a persistent connection and pushes
 * live trades/bars as they happen. Swappable like everything else.
 */
import type { Candle } from '@alphabot/shared';

export interface StreamHandlers {
  /** Fired on every live trade (tick). */
  onTrade(symbol: string, price: number, ts: number): void;
  /** Fired when a new bar (e.g. 1-minute) closes. */
  onBar?(symbol: string, candle: Candle): void;
  /** Connection lifecycle: 'connected' | 'authenticated' | 'disconnected' | error string. */
  onStatus?(status: string): void;
}

export interface StreamingProvider {
  readonly name: string;
  connect(handlers: StreamHandlers): Promise<void>;
  /** Subscribe to exactly this set of symbols (diffs against current). */
  setSymbols(symbols: string[]): void;
  close(): void;
}
