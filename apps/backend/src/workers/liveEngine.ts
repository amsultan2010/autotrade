/**
 * LiveEngine — real-time bot driver powered by the Alpaca WebSocket stream.
 * Replaces the 60s polling loop with event-driven behavior:
 *
 *   • on every live tick  → update price, INSTANTLY close any open trade whose
 *                           stop/target the tick hit (the real-time payoff)
 *   • on tick (throttled) → re-evaluate entries for that symbol per user
 *   • on bar close        → re-evaluate entries (a clean decision point)
 *   • periodically        → refresh the subscribed symbol set + mark-to-market
 *
 * Entry evaluation is throttled (not literally every tick) to avoid hammering
 * the DB/provider and overtrading; exits are checked near-instantly. Reuses the
 * exact analyze→decide→risk→execute pipeline from scanLoop.
 */
import { prisma } from '../lib/prisma.js';
import { getStreamingProvider } from '../services/marketdata/streaming.js';
import type { StreamingProvider } from '../services/marketdata/streaming.types.js';
import {
  evaluateSymbolEntry,
  loadUserBotContext,
  type UserBotContext,
} from './scanLoop.js';
import {
  closeOpenTradesForSymbolAtPrice,
  markToMarketUser,
} from '../services/execution/paper.engine.js';

const EXIT_THROTTLE_MS = 250; // near-instant stop/target checks
const ENTRY_THROTTLE_MS = 5_000; // per-symbol entry re-evaluation cap
const CTX_TTL_MS = 10_000; // cache user context briefly
const REFRESH_SYMBOLS_MS = 30_000;
const MARK_TO_MARKET_MS = 20_000;
const PERIODIC_SCAN_MS = 30_000; // scan all symbols on a timer even with no ticks

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
    void this.scanAll().catch(logErr); // scan immediately on start
    this.timers.push(setInterval(() => void this.refreshSymbols().catch(logErr), REFRESH_SYMBOLS_MS));
    this.timers.push(setInterval(() => void this.markToMarket().catch(logErr), MARK_TO_MARKET_MS));
    // Periodic scan ensures the bot keeps evaluating even when the market is
    // closed / no ticks are flowing (live ticks just make it faster).
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

    // Instant exits: close any trade on this symbol that hit stop/target.
    if (now - (this.lastExitCheck.get(symbol) ?? 0) >= EXIT_THROTTLE_MS) {
      this.lastExitCheck.set(symbol, now);
      void closeOpenTradesForSymbolAtPrice(symbol, price).catch(logErr);
    }

    // Throttled entry re-evaluation.
    if (now - (this.lastEntryEval.get(symbol) ?? 0) >= ENTRY_THROTTLE_MS) {
      this.lastEntryEval.set(symbol, now);
      void this.evaluateEntries(symbol).catch(logErr);
    }
  }

  private async getCtx(userId: string): Promise<UserBotContext | null> {
    const hit = this.ctxCache.get(userId);
    if (hit && Date.now() - hit.ts < CTX_TTL_MS) return hit.ctx;
    const ctx = await loadUserBotContext(userId);
    this.ctxCache.set(userId, { ctx, ts: Date.now() });
    return ctx;
  }

  /** Evaluate every subscribed symbol once (timer-driven; market-hours agnostic). */
  private async scanAll(): Promise<void> {
    for (const symbol of this.symbolUsers.keys()) {
      await this.evaluateEntries(symbol);
      // Also close positions on the latest known/REST price when no live ticks.
      const p = this.priceOf(symbol);
      if (p != null) await closeOpenTradesForSymbolAtPrice(symbol, p).catch(logErr);
    }
  }

  private async evaluateEntries(symbol: string): Promise<void> {
    const users = this.symbolUsers.get(symbol.toUpperCase());
    if (!users || users.size === 0) return;
    for (const userId of users) {
      const ctx = await this.getCtx(userId);
      if (!ctx || ctx.settings.mode !== 'PAPER') continue;
      const w = ctx.watchlist.find((x) => x.symbol.toUpperCase() === symbol.toUpperCase());
      try {
        await evaluateSymbolEntry(ctx, symbol, w?.exchange ?? 'US');
      } catch (err) {
        logErr(err);
      }
    }
  }

  /** Rebuild the symbol→users map and tell the stream what to subscribe to. */
  private async refreshSymbols(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', botSettings: { mode: { not: 'DISABLED' } } },
      select: { id: true, watchlist: { select: { symbol: true } } },
    });
    const map = new Map<string, Set<string>>();
    for (const u of users) {
      for (const w of u.watchlist) {
        const sym = w.symbol.toUpperCase();
        if (!map.has(sym)) map.set(sym, new Set());
        map.get(sym)!.add(u.id);
      }
    }
    this.symbolUsers = map;
    this.ctxCache.clear();
    this.stream?.setSymbols([...map.keys()]);
  }

  private async markToMarket(): Promise<void> {
    const userIds = new Set<string>();
    for (const set of this.symbolUsers.values()) for (const id of set) userIds.add(id);
    for (const userId of userIds) {
      await markToMarketUser(userId, (s) => this.priceOf(s)).catch(logErr);
    }
  }
}

function logErr(err: unknown): void {
  // eslint-disable-next-line no-console
  console.error('LiveEngine error:', err instanceof Error ? err.message : err);
}

export const liveEngine = new LiveEngine();
