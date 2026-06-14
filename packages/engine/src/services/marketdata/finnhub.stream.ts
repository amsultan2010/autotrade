/**
 * Finnhub real-time trade stream (WebSocket).
 *
 * Free tier includes a live US-stock trade feed — and a Finnhub key is
 * email-only (no KYC, no brokerage account), making this the lowest-friction
 * real-time source. Streams trades (ticks); it does not push OHLC bars, so the
 * engine sources candle history from the configured REST provider (e.g. Twelve
 * Data) and uses these ticks for instant exits + decision triggers.
 *
 * Connect: wss://ws.finnhub.io?token=KEY
 * Subscribe: {"type":"subscribe","symbol":"AAPL"}
 * Message:   {"type":"trade","data":[{"s":"AAPL","p":189.3,"t":169..,"v":100}]}
 */
import WebSocket from 'ws';
import { env } from '../../config/env';
import type { StreamHandlers, StreamingProvider } from './streaming.types.js';

interface FinnhubMsg {
  type: string;
  data?: Array<{ s: string; p: number; t: number; v: number }>;
}

export class FinnhubStream implements StreamingProvider {
  readonly name = 'finnhub';
  private ws: WebSocket | null = null;
  private handlers: StreamHandlers | null = null;
  private symbols = new Set<string>();
  private open_ = false;
  private closing = false;
  private reconnectDelay = 1_000;

  async connect(handlers: StreamHandlers): Promise<void> {
    this.handlers = handlers;
    this.open();
  }

  private open(): void {
    if (!env.FINNHUB_API_KEY) return;
    this.open_ = false;
    const ws = new WebSocket(`wss://ws.finnhub.io?token=${env.FINNHUB_API_KEY}`);
    this.ws = ws;

    ws.on('open', () => {
      this.open_ = true;
      this.reconnectDelay = 1_000;
      this.handlers?.onStatus?.('authenticated');
      for (const s of this.symbols) this.send({ type: 'subscribe', symbol: s });
    });

    ws.on('message', (raw) => {
      let msg: FinnhubMsg;
      try {
        msg = JSON.parse(raw.toString()) as FinnhubMsg;
      } catch {
        return;
      }
      if (msg.type === 'trade' && msg.data) {
        for (const t of msg.data) {
          this.handlers?.onTrade(t.s, t.p, t.t || Date.now());
        }
      }
    });

    ws.on('close', () => {
      this.open_ = false;
      this.handlers?.onStatus?.('disconnected');
      if (!this.closing) this.scheduleReconnect();
    });

    ws.on('error', (err) => this.handlers?.onStatus?.(`error: ${err.message}`));
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
    setTimeout(() => {
      if (!this.closing) this.open();
    }, delay);
  }

  private send(obj: unknown): void {
    if (this.open_ && this.ws) this.ws.send(JSON.stringify(obj));
  }

  setSymbols(next: string[]): void {
    const nextSet = new Set(next.map((s) => s.toUpperCase()));
    for (const s of nextSet) if (!this.symbols.has(s)) this.send({ type: 'subscribe', symbol: s });
    for (const s of this.symbols) if (!nextSet.has(s)) this.send({ type: 'unsubscribe', symbol: s });
    this.symbols = nextSet;
  }

  close(): void {
    this.closing = true;
    this.ws?.close();
    this.ws = null;
  }
}
