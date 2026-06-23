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

/** Merge Alpaca snapshot positions with Convex open trades for a unified dashboard view. */
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
    if (trade.brokerOrderId) continue;
    bySymbol.set(sym, {
      symbol: sym,
      qty: trade.qty,
      avgEntryPrice: trade.entryPrice,
      side: trade.side === 'SHORT' ? 'SHORT' : 'LONG',
      source: 'simulator',
      tradeId: trade._id,
    });
  }

  return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}
