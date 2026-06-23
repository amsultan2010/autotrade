/**
 * LiveEngine — real-time bot driver powered by the Alpaca WebSocket stream.
 */
import * as db from '../lib/convex-db';
import { getStreamingProvider } from '../services/marketdata/streaming';
import type { StreamingProvider } from '../services/marketdata/streaming.types';
import {
  evaluateSymbolEntry,
  loadUserBotContext,
  type UserBotContext,
} from './scanLoop';
import {
  closeOpenTradesForSymbolAtPrice,
  markToMarketUser,
} from '../services/execution/paper.engine';

const EXIT_THROTTLE_MS = 250;
const ENTRY_THROTTLE_MS = 5_000;
const CTX_TTL_MS = 10_000;
const REFRESH_SYMBOLS_MS = 30_000;
const MARK_TO_MARKET_MS = 20_000;
const PERIODIC_SCAN_MS = 30_000;

class LiveEngine {
  private stream: StreamingProvider | null = null;
  private livePrices = new Map<string, { price: number; ts: number }>();
  private symbolUsers = new Map<string, Set<string>>();
  private lastExitCheck = new Map<string, number>();
  private lastEntryEval = new Map<string, number>();
  private ctxCache = new Map<string, { ctx: UserBotContext | null; ts: number }>();
  private timers: NodeJS.Timeout[] = [];
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.stream = getStreamingProvider();
    if (!this.stream) {
      console.warn('LiveEngine: no streaming provider configured — not starting.');
      return;
    }
    this.started = true;

    const streamName = this.stream.name;
    await this.stream.connect({
      onTrade: (symbol, price, ts) => this.onTrade(symbol, price, ts),
      onBar: (symbol) => void this.evaluateEntries(symbol).catch(logErr),
      onStatus: (s) => console.log(`📡 ${streamName} stream: ${s}`),
    });

    await this.refreshSymbols();
    void this.scanAll().catch(logErr);
    this.timers.push(setInterval(() => void this.refreshSymbols().catch(logErr), REFRESH_SYMBOLS_MS));
    this.timers.push(setInterval(() => void this.markToMarket().catch(logErr), MARK_TO_MARKET_MS));
    this.timers.push(setInterval(() => void this.scanAll().catch(logErr), PERIODIC_SCAN_MS));
    console.log(`🟢 LiveEngine started (real-time ${streamName} stream + ${PERIODIC_SCAN_MS / 1000}s scan)`);
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.stream?.close();
    this.stream = null;
    this.started = false;
  }

  priceOf(symbol: string): number | undefined {
    return this.livePrices.get(symbol)?.price;
  }

  private onTrade(symbol: string, price: number, ts: number): void {
    this.livePrices.set(symbol, { price, ts });
    const now = Date.now();

    if (now - (this.lastExitCheck.get(symbol) ?? 0) >= EXIT_THROTTLE_MS) {
      this.lastExitCheck.set(symbol, now);
      void closeOpenTradesForSymbolAtPrice(symbol, price).catch(logErr);
    }

    if (now - (this.lastEntryEval.get(symbol) ?? 0) >= ENTRY_THROTTLE_MS) {
      this.lastEntryEval.set(symbol, now);
      void this.evaluateEntries(symbol).catch(logErr);
    }
  }

  private async getCtx(clerkId: string): Promise<UserBotContext | null> {
    const hit = this.ctxCache.get(clerkId);
    if (hit && Date.now() - hit.ts < CTX_TTL_MS) return hit.ctx;
    const ctx = await loadUserBotContext(clerkId);
    this.ctxCache.set(clerkId, { ctx, ts: Date.now() });
    return ctx;
  }

  private async scanAll(): Promise<void> {
    for (const symbol of this.symbolUsers.keys()) {
      await this.evaluateEntries(symbol);
      const p = this.priceOf(symbol);
      if (p != null) await closeOpenTradesForSymbolAtPrice(symbol, p).catch(logErr);
    }
  }

  private async evaluateEntries(symbol: string): Promise<void> {
    const users = this.symbolUsers.get(symbol.toUpperCase());
    if (!users || users.size === 0) return;
    for (const clerkId of users) {
      const ctx = await this.getCtx(clerkId);
      if (!ctx || (ctx.settings.mode !== 'PAPER' && ctx.settings.mode !== 'LIVE')) continue;
      const w = ctx.watchlist.find((x) => x.symbol.toUpperCase() === symbol.toUpperCase());
      try {
        await evaluateSymbolEntry(ctx, symbol, w?.exchange ?? 'US');
      } catch (err) {
        logErr(err);
      }
    }
  }

  private async refreshSymbols(): Promise<void> {
    const users = await db.getActiveBotUsers();
    const map = new Map<string, Set<string>>();
    for (const u of users) {
      for (const sym of u.symbols) {
        const upper = sym.toUpperCase();
        if (!map.has(upper)) map.set(upper, new Set());
        map.get(upper)!.add(u.clerkId);
      }
    }
    this.symbolUsers = map;
    this.ctxCache.clear();
    this.stream?.setSymbols([...map.keys()]);
  }

  private async markToMarket(): Promise<void> {
    const clerkIds = new Set<string>();
    for (const set of this.symbolUsers.values()) for (const id of set) clerkIds.add(id);
    for (const clerkId of clerkIds) {
      await markToMarketUser(clerkId, (s) => this.priceOf(s)).catch(logErr);
    }
  }
}

function logErr(err: unknown): void {
  console.error('LiveEngine error:', err instanceof Error ? err.message : err);
}

export const liveEngine = new LiveEngine();
