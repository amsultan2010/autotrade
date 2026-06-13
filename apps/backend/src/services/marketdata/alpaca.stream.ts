/**
 * Alpaca real-time market data stream (WebSocket).
 *
 * Manages TWO feeds on separate sockets and routes symbols by type:
 *   - stocks → wss://stream.data.alpaca.markets/v2/{feed}        (market hours)
 *   - crypto → wss://stream.data.alpaca.markets/v1beta3/crypto/us (24/7, BTC/USD)
 *
 * Both authenticate with the Alpaca key/secret, subscribe to trades + bars, and
 * push to the same handlers. Each auto-reconnects with backoff. Free IEX caps
 * the number of stock symbols, so keep stock watchlists modest.
 */
import WebSocket from 'ws';
import type { Candle } from '@autotrade/shared';
import { env } from '../../config/env.js';
import { isCryptoSymbol } from './alpaca.provider.js';
import type { StreamHandlers, StreamingProvider } from './streaming.types.js';

interface AlpacaMsg {
  T: string;
  msg?: string;
  code?: number;
  S?: string;
  p?: number;
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
}

/** One Alpaca WebSocket connection (stocks OR crypto). */
class AlpacaFeed {
  private ws: WebSocket | null = null;
  private symbols = new Set<string>();
  private authed = false;
  private closing = false;
  private reconnectDelay = 1_000;

  constructor(
    private readonly url: string,
    private readonly label: string,
    private readonly handlers: StreamHandlers,
  ) {}

  connect(): void {
    this.open();
  }

  private open(): void {
    if (!env.ALPACA_API_KEY || !env.ALPACA_API_SECRET) return;
    this.authed = false;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on('open', () => {
      ws.send(JSON.stringify({ action: 'auth', key: env.ALPACA_API_KEY, secret: env.ALPACA_API_SECRET }));
    });
    ws.on('message', (raw) => this.onMessage(raw.toString()));
    ws.on('close', () => {
      this.authed = false;
      this.handlers.onStatus?.(`${this.label} disconnected`);
      if (!this.closing) this.scheduleReconnect();
    });
    ws.on('error', (err) => this.handlers.onStatus?.(`${this.label} error: ${err.message}`));
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
    setTimeout(() => {
      if (!this.closing) this.open();
    }, delay);
  }

  private onMessage(text: string): void {
    let msgs: AlpacaMsg[];
    try {
      msgs = JSON.parse(text) as AlpacaMsg[];
    } catch {
      return;
    }
    for (const m of msgs) {
      switch (m.T) {
        case 'success':
          if (m.msg === 'authenticated') {
            this.authed = true;
            this.reconnectDelay = 1_000;
            this.handlers.onStatus?.(`${this.label} authenticated`);
            this.sendSubscribe([...this.symbols]);
          }
          break;
        case 'error':
          this.handlers.onStatus?.(`${this.label} error ${m.code}: ${m.msg}`);
          break;
        case 't':
          if (m.S && typeof m.p === 'number') {
            this.handlers.onTrade(m.S, m.p, m.t ? Date.parse(m.t) : Date.now());
          }
          break;
        case 'b':
          if (m.S && this.handlers.onBar && typeof m.c === 'number') {
            const candle: Candle = {
              t: m.t ? Date.parse(m.t) : Date.now(),
              o: m.o ?? m.c,
              h: m.h ?? m.c,
              l: m.l ?? m.c,
              c: m.c,
              v: m.v ?? 0,
            };
            this.handlers.onBar(m.S, candle);
          }
          break;
        default:
          break;
      }
    }
  }

  private sendSubscribe(symbols: string[]): void {
    if (!this.authed || !this.ws || symbols.length === 0) return;
    this.ws.send(JSON.stringify({ action: 'subscribe', trades: symbols, bars: symbols }));
  }
  private sendUnsubscribe(symbols: string[]): void {
    if (!this.authed || !this.ws || symbols.length === 0) return;
    this.ws.send(JSON.stringify({ action: 'unsubscribe', trades: symbols, bars: symbols }));
  }

  setSymbols(next: string[]): void {
    const nextSet = new Set(next);
    const toAdd = [...nextSet].filter((s) => !this.symbols.has(s));
    const toRemove = [...this.symbols].filter((s) => !nextSet.has(s));
    this.symbols = nextSet;
    if (this.authed) {
      this.sendSubscribe(toAdd);
      this.sendUnsubscribe(toRemove);
    }
  }

  close(): void {
    this.closing = true;
    this.ws?.close();
    this.ws = null;
  }
}

export class AlpacaStream implements StreamingProvider {
  readonly name = 'alpaca';
  private stockFeed: AlpacaFeed | null = null;
  private cryptoFeed: AlpacaFeed | null = null;

  async connect(handlers: StreamHandlers): Promise<void> {
    this.stockFeed = new AlpacaFeed(
      `wss://stream.data.alpaca.markets/v2/${env.ALPACA_FEED}`,
      'stocks',
      handlers,
    );
    this.cryptoFeed = new AlpacaFeed(
      'wss://stream.data.alpaca.markets/v1beta3/crypto/us',
      'crypto',
      handlers,
    );
    this.stockFeed.connect();
    this.cryptoFeed.connect();
  }

  setSymbols(next: string[]): void {
    const symbols = next.map((s) => s.toUpperCase());
    this.stockFeed?.setSymbols(symbols.filter((s) => !isCryptoSymbol(s)));
    this.cryptoFeed?.setSymbols(symbols.filter(isCryptoSymbol));
  }

  close(): void {
    this.stockFeed?.close();
    this.cryptoFeed?.close();
  }
}
