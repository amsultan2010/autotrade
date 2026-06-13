/**
 * PaperEngine — simulates trades against REAL market prices (req #6).
 * Never invents prices. Opens positions from approved signals and closes them
 * when the price hits the stop or target, recording full P/L, mistake tags, and
 * chart snapshots, then feeds the learning loop.
 *
 * Two close paths share `applyClose`:
 *   - monitorUserOpenTrades(): polling — fetches quotes via REST (fallback mode)
 *   - closeOpenTradesForSymbolAtPrice(): real-time — called by the stream engine
 *     on each live tick, so stops/targets trigger instantly.
 *
 * Cash model: balance changes only on close (by realized P/L); equity =
 * balance + unrealized P/L of still-open positions (mark-to-market).
 */
import type { Prisma, Trade } from '@prisma/client';
import type { MistakeTag, TradeSignal } from '@autotrade/shared';
import { prisma } from '../../lib/prisma.js';
import { getMarketData } from '../marketdata/index.js';
import { recordOutcome } from '../learning/index.js';
import type { RiskDecision } from '../risk/index.js';

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
  userId: string;
  signalId: string;
  signal: TradeSignal;
  risk: Extract<RiskDecision, { approved: true }>;
  entrySnapshot: EntrySnapshot;
}): Promise<string> {
  const { userId, signalId, signal, risk, entrySnapshot } = params;
  const trade = await prisma.trade.create({
    data: {
      userId,
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
      result: 'OPEN',
      entrySnapshot: entrySnapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return trade.id;
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
export function exitFor(trade: Trade, price: number): { exitPrice: number; hitStop: boolean } | null {
  const isLong = trade.side === 'LONG';
  const hitStop = trade.stopLoss != null && (isLong ? price <= trade.stopLoss : price >= trade.stopLoss);
  const hitTarget =
    trade.takeProfit != null && (isLong ? price >= trade.takeProfit : price <= trade.takeProfit);
  if (!hitStop && !hitTarget) return null;
  return { exitPrice: hitStop ? (trade.stopLoss as number) : (trade.takeProfit as number), hitStop };
}

/** Finalize one trade close: write the ledger row + feed learning. Returns P/L.
 * Does NOT touch the cash account (caller updates balance/equity). */
async function applyClose(trade: Trade, exitPrice: number, hitStop: boolean): Promise<number> {
  const isLong = trade.side === 'LONG';
  const pnl = isLong
    ? (exitPrice - trade.entryPrice) * trade.qty
    : (trade.entryPrice - exitPrice) * trade.qty;
  const result = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';
  const entry = (trade.entrySnapshot as unknown as EntrySnapshot) ?? null;

  await prisma.trade.update({
    where: { id: trade.id },
    data: {
      exitPrice,
      pnl,
      result,
      exitReason: hitStop ? 'Stop loss hit' : 'Take profit hit',
      mistakeTags: mistakeTagsAt(hitStop, entry),
      reasoningCorrect: result === 'WIN',
      exitSnapshot: { price: exitPrice, ts: Date.now() } as unknown as Prisma.InputJsonValue,
      closedAt: new Date(),
    },
  });

  await recordOutcome({
    userId: trade.userId,
    strategy: trade.strategy,
    symbol: trade.symbol,
    pnl,
    win: result === 'WIN',
  });
  return pnl;
}

function unrealized(trade: Trade, price: number): number {
  return trade.side === 'LONG'
    ? (price - trade.entryPrice) * trade.qty
    : (trade.entryPrice - price) * trade.qty;
}

/**
 * Polling monitor: check a user's open trades against REST quotes and close any
 * that hit stop/target. Used when streaming is off. Returns realized P/L.
 */
export async function monitorUserOpenTrades(userId: string): Promise<number> {
  const open = await prisma.trade.findMany({ where: { userId, mode: 'PAPER', result: 'OPEN' } });
  if (open.length === 0) return 0;

  const md = getMarketData();
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
    const account = await prisma.paperAccount.findUnique({ where: { userId } });
    if (account) {
      const balance = account.balance + realized;
      await prisma.paperAccount.update({
        where: { userId },
        data: { balance, equity: balance + unreal },
      });
    }
  }
  return realized;
}

/**
 * Real-time monitor: called by the stream engine on each live tick for a symbol.
 * Closes any open paper trade on that symbol whose stop/target the tick hit,
 * instantly — no polling delay. Returns realized P/L this tick.
 */
export async function closeOpenTradesForSymbolAtPrice(symbol: string, price: number): Promise<number> {
  const open = await prisma.trade.findMany({ where: { symbol, mode: 'PAPER', result: 'OPEN' } });
  if (open.length === 0) return 0;

  const realizedByUser = new Map<string, number>();
  for (const trade of open) {
    const exit = exitFor(trade, price);
    if (!exit) continue;
    const pnl = await applyClose(trade, exit.exitPrice, exit.hitStop);
    realizedByUser.set(trade.userId, (realizedByUser.get(trade.userId) ?? 0) + pnl);
  }

  let total = 0;
  for (const [userId, realized] of realizedByUser) {
    total += realized;
    const account = await prisma.paperAccount.findUnique({ where: { userId } });
    if (account) {
      const balance = account.balance + realized;
      await prisma.paperAccount.update({ where: { userId }, data: { balance, equity: balance } });
    }
  }
  return total;
}

/** Manually close one open paper trade at the current market price. */
export async function closeTradeAtMarket(
  tradeId: string,
  userId: string,
): Promise<{ closed: boolean; pnl?: number; reason?: string }> {
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId, mode: 'PAPER', result: 'OPEN' },
  });
  if (!trade) return { closed: false, reason: 'Trade not found or already closed' };

  let price: number;
  try {
    price = (await getMarketData().getQuote(trade.symbol)).price;
  } catch {
    return { closed: false, reason: 'Could not get a current price' };
  }

  const isLong = trade.side === 'LONG';
  const pnl = isLong ? (price - trade.entryPrice) * trade.qty : (trade.entryPrice - price) * trade.qty;
  const result = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';

  await prisma.trade.update({
    where: { id: trade.id },
    data: {
      exitPrice: price,
      pnl,
      result,
      exitReason: 'Manually closed',
      reasoningCorrect: result === 'WIN',
      exitSnapshot: { price, ts: Date.now() } as unknown as Prisma.InputJsonValue,
      closedAt: new Date(),
    },
  });

  const account = await prisma.paperAccount.findUnique({ where: { userId } });
  if (account) {
    const balance = account.balance + pnl;
    await prisma.paperAccount.update({ where: { userId }, data: { balance, equity: balance } });
  }
  await recordOutcome({ userId, strategy: trade.strategy, symbol: trade.symbol, pnl, win: result === 'WIN' });
  return { closed: true, pnl };
}

/**
 * Recompute a user's equity = balance + unrealized, using a live-price lookup.
 * Called periodically by the stream engine to keep equity mark-to-market.
 */
export async function markToMarketUser(
  userId: string,
  priceOf: (symbol: string) => number | undefined,
): Promise<void> {
  const account = await prisma.paperAccount.findUnique({ where: { userId } });
  if (!account) return;
  const open = await prisma.trade.findMany({ where: { userId, mode: 'PAPER', result: 'OPEN' } });
  let unreal = 0;
  for (const trade of open) {
    const p = priceOf(trade.symbol);
    if (p != null) unreal += unrealized(trade, p);
  }
  await prisma.paperAccount.update({ where: { userId }, data: { equity: account.balance + unreal } });
}
