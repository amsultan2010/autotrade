export interface BrokerPositionView {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  side: 'LONG' | 'SHORT';
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
}

export interface OpenTradeView {
  _id: string;
  symbol: string;
  qty: number;
  entryPrice: number;
  side: string;
  brokerOrderId?: string;
}

export interface DisplayPosition extends BrokerPositionView {
  source: 'broker' | 'simulator';
  tradeId?: string;
}

/** Merge Alpaca snapshot positions with Supabase open trades for a unified dashboard view. */
export function mergeOpenPositions(
  brokerPositions: BrokerPositionView[],
  openTrades: OpenTradeView[],
): DisplayPosition[] {
  const bySymbol = new Map<string, DisplayPosition>();

  for (const p of brokerPositions) {
    bySymbol.set(p.symbol.toUpperCase(), { ...p, source: 'broker' });
  }

  for (const trade of openTrades) {
    const sym = trade.symbol.toUpperCase();
    const existing = bySymbol.get(sym);
    if (existing) {
      existing.tradeId = trade._id;
      continue;
    }
    bySymbol.set(sym, {
      symbol: sym,
      qty: trade.qty,
      avgEntryPrice: trade.entryPrice,
      side: trade.side === 'SHORT' ? 'SHORT' : 'LONG',
      source: trade.brokerOrderId ? 'broker' : 'simulator',
      tradeId: trade._id,
    });
  }

  return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Whether an open trade is currently in profit (per-trade entry, not position-level). */
export function isOpenTradeWinning(
  trade: { symbol: string; side: string; entryPrice: number; qty?: number },
  brokerPosition: { currentPrice?: number } | undefined,
  quotePrice: number | undefined,
): boolean {
  const price = brokerPosition?.currentPrice ?? quotePrice;
  if (price == null) return false;
  return unrealizedPnlForTrade(trade, price) > 0;
}

/** Unrealized P&L for a single open trade at the given market price. */
export function unrealizedPnlForTrade(
  trade: { side: string; entryPrice: number; qty?: number },
  price: number,
): number {
  const qty = trade.qty ?? 1;
  if (trade.side === 'SHORT') {
    return (trade.entryPrice - price) * qty;
  }
  return (price - trade.entryPrice) * qty;
}

/** Count open trades that are currently in profit. */
export function countWinningOpenTrades(
  brokerPositions: BrokerPositionView[],
  openTrades: OpenTradeView[],
  quotesBySymbol: Record<string, number> = {},
): number {
  const brokerBySymbol = new Map(
    brokerPositions.map((p) => [p.symbol.toUpperCase(), p]),
  );
  return openTrades.filter((t) =>
    isOpenTradeWinning(
      t,
      brokerBySymbol.get(t.symbol.toUpperCase()),
      quotesBySymbol[t.symbol.toUpperCase()],
    ),
  ).length;
}

/** Count unified open positions (broker snapshot + Supabase open trades). */
export function countOpenPositions(
  brokerPositions: BrokerPositionView[],
  openTrades: OpenTradeView[],
): number {
  return mergeOpenPositions(brokerPositions, openTrades).length;
}

/** Fill unrealized P&L on simulator rows using live quote prices. */
export function enrichDisplayPositions(
  positions: DisplayPosition[],
  quotesBySymbol: Record<string, number>,
): DisplayPosition[] {
  return positions.map((p) => {
    if (p.source === 'broker' && p.unrealizedPnl != null) return p;
    const price = quotesBySymbol[p.symbol.toUpperCase()];
    if (price == null || !Number.isFinite(price)) return p;
    const pnl = unrealizedPnlForTrade(
      { side: p.side, entryPrice: p.avgEntryPrice, qty: p.qty },
      price,
    );
    const costBasis = Math.abs(p.avgEntryPrice * p.qty) || 1;
    const pnlPct = (pnl / costBasis) * 100;
    return {
      ...p,
      currentPrice: price,
      marketValue: price * p.qty,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      unrealizedPnlPct: Math.round(pnlPct * 100) / 100,
    };
  });
}
