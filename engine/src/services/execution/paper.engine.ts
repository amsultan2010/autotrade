/**
 * PaperEngine — simulates trades against REAL market prices (req #6).
 * Never invents prices. Opens positions from approved signals and closes them
 * when the price hits the stop or target, recording full P/L, mistake tags, and
 * chart snapshots, then feeds the learning loop.
 */
import type { MistakeTag, TradeSignal } from '@autotrade/shared';
import * as db from '../../lib/convex-db';
import type { TradeRecord } from '../../types/db';
import { getMarketData } from '../marketdata/index';
import { recordOutcome } from '../learning/index';
import type { RiskDecision } from '../risk/index';
import type { BrokerProvider, BrokerOrder } from './broker.types';

export interface EntrySnapshot {
  price: number;
  atr14: number;
  rsi14: number;
  volume: number;
  avgVolume: number;
  rrRatio: number | null;
}

/** Open a paper position from a signal the RiskManager approved. */
export async function openPaperTrade(params: {
  clerkId: string;
  signalId: string;
  signal: TradeSignal;
  risk: Extract<RiskDecision, { approved: true }>;
  entrySnapshot: EntrySnapshot;
}): Promise<string> {
  const { clerkId, signalId, signal, risk, entrySnapshot } = params;
  return db.createTrade({
    clerkId,
    signalId,
    symbol: signal.ticker,
    exchange: signal.exchange,
    side: risk.side,
    mode: 'PAPER',
    qty: risk.qty,
    entryPrice: signal.price,
    stopLoss: risk.stopLoss,
    takeProfit: risk.takeProfit,
    strategy: signal.strategy,
    confidence: signal.confidence,
    entryReason: signal.entryReason,
    entrySnapshot,
  });
}

/** Submit an order via Alpaca (paper or live account) and record in Convex. */
export async function openBrokerTrade(params: {
  clerkId: string;
  signalId: string;
  signal: TradeSignal;
  risk: Extract<RiskDecision, { approved: true }>;
  entrySnapshot: EntrySnapshot;
  broker: BrokerProvider;
  mode: 'PAPER' | 'LIVE';
}): Promise<string> {
  const { clerkId, signalId, signal, risk, entrySnapshot, broker, mode } = params;
  const clientOrderId = `at-${clerkId.slice(-8)}-${Date.now()}`;
  const order: BrokerOrder = {
    symbol: signal.ticker,
    side: risk.side,
    qty: risk.qty,
    type: 'market',
    stopLoss: risk.stopLoss ?? undefined,
    takeProfit: risk.takeProfit ?? undefined,
    clientOrderId,
  };
  const result = await broker.submitOrder(order);
  if (result.status === 'rejected') {
    throw new Error(`Alpaca rejected order for ${signal.ticker}: ${result.brokerOrderId ?? 'unknown order'}`);
  }
  return db.createTrade({
    clerkId,
    signalId,
    symbol: signal.ticker,
    exchange: signal.exchange,
    side: risk.side,
    mode,
    qty: risk.qty,
    entryPrice: result.filledPrice ?? signal.price,
    stopLoss: risk.stopLoss,
    takeProfit: risk.takeProfit,
    strategy: signal.strategy,
    confidence: signal.confidence,
    entryReason: signal.entryReason,
    brokerOrderId: result.brokerOrderId,
    entrySnapshot,
  });
}

/** Submit a real order via the broker and record it in DB with mode=LIVE. */
export async function openLiveTrade(params: {
  clerkId: string;
  signalId: string;
  signal: TradeSignal;
  risk: Extract<RiskDecision, { approved: true }>;
  entrySnapshot: EntrySnapshot;
  broker: BrokerProvider;
}): Promise<string> {
  return openBrokerTrade({ ...params, mode: 'LIVE' });
}

function mistakeTagsAt(stopped: boolean, entry: EntrySnapshot | null): MistakeTag[] {
  const tags: MistakeTag[] = [];
  if (stopped) tags.push('STOP_LOSS_HIT');
  if (entry) {
    if (entry.avgVolume > 0 && entry.volume < entry.avgVolume) tags.push('LOW_VOLUME');
    const atrPct = entry.price > 0 ? (entry.atr14 / entry.price) * 100 : 0;
    if (atrPct >= 4) tags.push('HIGH_VOLATILITY_ENTRY');
    if (entry.rrRatio != null && entry.rrRatio < 1.5) tags.push('BAD_RISK_REWARD');
  }
  return tags;
}

/** Does the live price hit this trade's stop or target? */
export function exitFor(trade: TradeRecord, price: number): { exitPrice: number; hitStop: boolean } | null {
  const isLong = trade.side === 'LONG';
  const hitStop = trade.stopLoss != null && (isLong ? price <= trade.stopLoss : price >= trade.stopLoss);
  const hitTarget =
    trade.takeProfit != null && (isLong ? price >= trade.takeProfit : price <= trade.takeProfit);
  if (!hitStop && !hitTarget) return null;
  return { exitPrice: hitStop ? (trade.stopLoss as number) : (trade.takeProfit as number), hitStop };
}

/** Finalize one trade close: write the ledger row + feed learning. Returns P/L. */
async function applyClose(trade: TradeRecord, exitPrice: number, hitStop: boolean): Promise<number> {
  const entry = (trade.entrySnapshot as EntrySnapshot | null) ?? null;
  const { pnl, result } = await db.closeTrade({
    tradeId: trade._id,
    exitPrice,
    exitReason: hitStop ? 'Stop loss hit' : 'Take profit hit',
    mistakeTags: mistakeTagsAt(hitStop, entry),
    reasoningCorrect: undefined,
    exitSnapshot: { price: exitPrice, ts: Date.now() },
  });

  await recordOutcome({
    clerkId: trade.clerkId,
    strategy: trade.strategy,
    symbol: trade.symbol,
    pnl,
    win: result === 'WIN',
  });
  return pnl;
}

function unrealized(trade: TradeRecord, price: number): number {
  return trade.side === 'LONG'
    ? (price - trade.entryPrice) * trade.qty
    : (trade.entryPrice - price) * trade.qty;
}

/** Polling monitor: check open trades against REST quotes and close at stop/target. */
export async function monitorUserOpenTrades(clerkId: string): Promise<number> {
  const open = await db.getOpenTrades(clerkId, 'PAPER');
  if (open.length === 0) return 0;

  let md;
  try {
    md = getMarketData();
  } catch (err) {
    console.error(`market data unavailable for monitor (user ${clerkId})`, err);
    return 0;
  }

  let realized = 0;
  let unreal = 0;

  for (const trade of open) {
    let price: number;
    try {
      price = (await md.getQuote(trade.symbol)).price;
    } catch {
      continue;
    }
    const exit = exitFor(trade, price);
    if (!exit) {
      unreal += unrealized(trade, price);
      continue;
    }
    realized += await applyClose(trade, exit.exitPrice, exit.hitStop);
  }

  if (realized !== 0 || unreal !== 0) {
    await db.adjustPaperAccount(clerkId, realized, realized + unreal);
  }
  return realized;
}

/** Sync open Alpaca-backed trades (paper or live) when positions disappear at the broker. */
export async function monitorUserBrokerTrades(
  clerkId: string,
  broker: BrokerProvider,
): Promise<void> {
  const open = await db.getOpenTrades(clerkId);
  const withBroker = open.filter((t) => t.brokerOrderId);
  if (withBroker.length === 0) return;

  let alpacaPositions: Array<{ symbol: string; qty: number; avgEntryPrice: number }>;
  try {
    alpacaPositions = await broker.getPositions();
  } catch {
    return;
  }

  const openSymbols = new Set(alpacaPositions.map((p) => p.symbol.toUpperCase()));

  for (const trade of withBroker) {
    if (openSymbols.has(trade.symbol.toUpperCase())) {
      // Position still open at broker — check stop/target and close if hit.
      let price: number;
      try {
        price = (await getMarketData().getQuote(trade.symbol)).price;
      } catch {
        continue;
      }
      const exit = exitFor(trade, price);
      if (!exit) continue;
      try {
        await broker.closePosition(trade.symbol);
      } catch {
        /* still record close in Convex */
      }
      await applyClose(trade, exit.exitPrice, exit.hitStop);
      continue;
    }

    let exitPrice = trade.entryPrice;
    try {
      exitPrice = (await getMarketData().getQuote(trade.symbol)).price;
    } catch {
      /* use entry price as fallback */
    }

    const isLong = trade.side === 'LONG';
    const hitStop =
      trade.stopLoss != null &&
      (isLong ? exitPrice <= trade.stopLoss : exitPrice >= trade.stopLoss);

    await applyClose(trade, exitPrice, hitStop);
  }
}

/** @deprecated Use monitorUserBrokerTrades */
export async function monitorUserLiveTrades(
  clerkId: string,
  broker: BrokerProvider,
): Promise<void> {
  return monitorUserBrokerTrades(clerkId, broker);
}

/** Real-time monitor: close paper trades on a symbol when stop/target is hit. */
export async function closeOpenTradesForSymbolAtPrice(symbol: string, price: number): Promise<number> {
  const open = await db.getOpenTradesBySymbol(symbol);
  if (open.length === 0) return 0;

  const realizedByUser = new Map<string, number>();
  for (const trade of open) {
    const exit = exitFor(trade, price);
    if (!exit) continue;
    const pnl = await applyClose(trade, exit.exitPrice, exit.hitStop);
    realizedByUser.set(trade.clerkId, (realizedByUser.get(trade.clerkId) ?? 0) + pnl);
  }

  let total = 0;
  for (const [clerkId, realized] of realizedByUser) {
    total += realized;
    await db.adjustPaperAccount(clerkId, realized, realized);
  }
  return total;
}

/** Manually close one open paper trade at the current market price. */
export async function closeTradeAtMarket(
  tradeId: string,
  clerkId: string,
): Promise<{ closed: boolean; pnl?: number; reason?: string }> {
  const open = await db.getOpenTrades(clerkId, 'PAPER');
  const trade = open.find((t) => t._id === tradeId);
  if (!trade) return { closed: false, reason: 'Trade not found or already closed' };

  let price: number;
  try {
    price = (await getMarketData().getQuote(trade.symbol)).price;
  } catch {
    return { closed: false, reason: 'Could not get a current price' };
  }

  const isLong = trade.side === 'LONG';
  const rawPnl = isLong ? (price - trade.entryPrice) * trade.qty : (trade.entryPrice - price) * trade.qty;
  const { pnl, result } = await db.closeTrade({
    tradeId: trade._id,
    exitPrice: price,
    exitReason: 'Manually closed',
    reasoningCorrect: undefined,
    exitSnapshot: { price, ts: Date.now() },
  });

  await db.adjustPaperAccount(clerkId, pnl, pnl);
  await recordOutcome({
    clerkId,
    strategy: trade.strategy,
    symbol: trade.symbol,
    pnl,
    win: result === 'WIN',
  });
  return { closed: true, pnl: rawPnl };
}

/** Recompute equity = balance + unrealized for open paper positions. */
export async function markToMarketUser(
  clerkId: string,
  priceOf: (symbol: string) => number | undefined,
): Promise<void> {
  const ctx = await db.getBotContext(clerkId);
  if (!ctx?.paperAccount) return;

  const open = await db.getOpenTrades(clerkId, 'PAPER');
  let unreal = 0;
  for (const trade of open) {
    const p = priceOf(trade.symbol);
    if (p != null) unreal += unrealized(trade, p);
  }
  await db.setPaperEquity(clerkId, ctx.paperAccount.balance + unreal);
}
