'use client';
import { useEffect, useState } from 'react';
import { TableSkeleton } from '../components/Skeleton';
import { countOpenPositions, countWinningOpenTrades, type OpenTradeView } from '@/lib/positions';
import { formatUserError } from '@/lib/error-tracking';
import { useBrokerSnapshot, useBrokerStatus, useTrades, dataApi } from '@/src/hooks/data';

type TradeResult = 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';

interface TradeItem {
  _id: string;
  symbol: string;
  side: string;
  mode: string;
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  result: TradeResult;
  stopLoss?: number;
  takeProfit?: number;
  strategy: string;
  confidence: number;
  entryReason: string;
  exitReason?: string;
  mistakeTags?: string[];
  reasoningCorrect?: boolean;
  openedAt: number;
  closedAt?: number;
}

function money(n: number | null | undefined): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function TradeHistory() {
  const [filter, setFilter] = useState<'all' | TradeResult>('all');
  const [closingId, setClosingId] = useState<string | null>(null);
  const [cashingOut, setCashingOut] = useState(false);
  const [cashOutMessage, setCashOutMessage] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [quoteBySymbol, setQuoteBySymbol] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: brokerStatus } = useBrokerStatus();
  const { data: tradeData, loading: tradesLoading } = useTrades({
    result: filter === 'all' ? undefined : filter,
  });
  
  
  
  const { data: brokerSnapshot } = useBrokerSnapshot();
  const { data: allOpenTrades, loading: openTradesLoading } = useTrades({ result: 'OPEN', limit: 100 });

  useEffect(() => {
    if (brokerStatus?.connected) {
      dataApi.syncBroker().catch(() => {});
    }
  }, [brokerStatus?.connected]);

  const openItems: OpenTradeView[] = (allOpenTrades ?? []) as OpenTradeView[];
  const openSymbolsKey = openItems.map((t) => t.symbol).sort().join(',');

  useEffect(() => {
    if (!openSymbolsKey) {
      setQuoteBySymbol({});
      return;
    }
    const symbols = [...new Set(openSymbolsKey.split(',').filter(Boolean))];
    let cancelled = false;

    Promise.all(
      symbols.map(async (symbol: string) => {
        try {
          const res = await fetch(`/api/v1/market/quote/${encodeURIComponent(symbol)}`);
          if (!res.ok) return null;
          const data = (await res.json()) as { price?: number };
          return data.price != null ? ([symbol.toUpperCase(), data.price] as const) : null;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const row of rows) {
        if (row) next[row[0]] = row[1];
      }
      setQuoteBySymbol(next);
    });

    return () => { cancelled = true; };
  }, [openSymbolsKey]);

  const trades = (tradeData ?? []) as TradeItem[];
  const selected = trades.find((t) => t._id === selectedId) ?? null;
  const openPositionCount = countOpenPositions(
    brokerSnapshot?.positions ?? [],
    openItems,
  );
  const winningOpenCount = countWinningOpenTrades(
    brokerSnapshot?.positions ?? [],
    openItems,
    quoteBySymbol,
  );
  const canCashOut = !openTradesLoading && winningOpenCount > 0;

  async function cashOut() {
    if (!canCashOut) return;
    setCashingOut(true);
    setCashOutMessage(null);
    try {
      if (brokerStatus?.connected) {
        await dataApi.syncBroker().catch(() => {});
      }
      const result = await dataApi.cashOutWinners();
      setCashOutMessage(
        result.closed > 0
          ? `Closed ${result.closed} winning position${result.closed === 1 ? '' : 's'}`
          : 'No open positions were in profit. Nothing closed',
      );
      if (brokerStatus?.connected) {
        await dataApi.syncBroker().catch(() => {});
      }
    } catch (err) {
      setCashOutMessage(formatUserError(err, 'Cash out failed. Try again.'));
    } finally {
      setCashingOut(false);
    }
  }

  async function closeNow(id: string) {
    setClosingId(id);
    setCloseError(null);
    try {
      await dataApi.closeTrade(id);
    } catch (err) {
      setCloseError(formatUserError(err, 'Failed to close trade.'));
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div className="page" data-tour="trade-history">
      {closeError && (
        <p className="muted" role="alert" style={{ marginBottom: '0.75rem' }}>
          {closeError}
        </p>
      )}

      <header className="page-head">
        <h1>Trade History</h1>
        <div className="row gap" style={{ alignItems: 'center' }}>
          <button
            type="button"
            className={`btn-primary${!canCashOut ? ' disabled' : ''}`}
            disabled={cashingOut || !canCashOut}
            title={
              winningOpenCount > 0
                ? `Close ${winningOpenCount} winning open position${winningOpenCount === 1 ? '' : 's'}`
                : openTradesLoading
                  ? 'Loading open positions…'
                  : 'No open positions are currently in profit'
            }
            onClick={() => void cashOut()}
          >
            {cashingOut ? 'Cashing out…' : 'Cash Out'}
          </button>
        </div>
        <div className="seg small" role="tablist" aria-label="Filter trades">
          {(['all', 'OPEN', 'WIN', 'LOSS'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </header>

      {cashOutMessage && (
        <div className="error-banner" style={{ marginBottom: '0.75rem', background: 'rgba(0,200,150,0.1)', borderColor: 'rgba(0,200,150,0.35)' }}>
          {cashOutMessage}
        </div>
      )}

      {brokerStatus?.connected && (
        <p className="muted" style={{ marginBottom: '0.75rem', fontSize: 13 }}>
          {openPositionCount} open position(s) ·{' '}
          {trades.length} total trade(s) in history
          {brokerStatus.paper ? ' (Alpaca paper)' : ' (Alpaca live)'}.
          Dashboard positions and this list use the same trade records.
        </p>
      )}

      <div className="split">
        <section className="panel grow">
          {tradeData === undefined ? (
            <TableSkeleton rows={8} />
          ) : trades.length === 0 ? (
            <p className="muted">
              No trades match this filter yet.
              {brokerStatus?.connected
                ? ' Start the bot or tap Scan Now on the dashboard to open trades via Alpaca.'
                : ' Connect Alpaca in Settings, then start the bot.'}
            </p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Opened</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Mode</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P/L</th>
                  <th>Result</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr
                    key={t._id}
                    className={selectedId === t._id ? 'row-sel' : ''}
                    onClick={() => setSelectedId(t._id === selectedId ? null : t._id)}
                  >
                    <td className="muted">{new Date(t.openedAt).toLocaleString()}</td>
                    <td className="mono">{t.symbol}</td>
                    <td>{t.side}</td>
                    <td><span className="tag">{t.mode}</span></td>
                    <td>{money(t.entryPrice)}</td>
                    <td>{money(t.exitPrice ?? null)}</td>
                    <td className={t.pnl == null ? '' : t.pnl >= 0 ? 'pos' : 'neg'}>{money(t.pnl ?? null)}</td>
                    <td><span className={`pill pill-${t.result.toLowerCase()}`}>{t.result}</span></td>
                    <td className="right">
                      {t.result === 'OPEN' && (
                        <button
                          className="btn-text danger"
                          disabled={closingId === t._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void closeNow(t._id);
                          }}
                        >
                          {closingId === t._id ? 'Closing…' : 'Close'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selected && (
          <aside className="panel detail">
            <div className="detail-head">
              <h2 className="mono">{selected.symbol}</h2>
              <button className="btn-text" onClick={() => setSelectedId(null)}>Close</button>
            </div>
            <Detail label="Strategy" value={selected.strategy} />
            <Detail label="Confidence" value={`${Math.round(selected.confidence)}%`} />
            <Detail label="Side / Mode" value={`${selected.side} · ${selected.mode}`} />
            <Detail label="Qty" value={String(selected.qty)} />
            <Detail label="Entry / Exit" value={`${money(selected.entryPrice)} → ${money(selected.exitPrice ?? null)}`} />
            <Detail label="Stop / Target" value={`${money(selected.stopLoss ?? null)} / ${money(selected.takeProfit ?? null)}`} />
            <Detail label="P/L" value={money(selected.pnl ?? null)} />
            <Detail label="Entry reason" value={selected.entryReason} />
            <Detail label="Exit reason" value={selected.exitReason ?? '--'} />
            <Detail
              label="Mistake tags"
              value={selected.mistakeTags?.length ? selected.mistakeTags.join(', ') : 'none'}
            />
            <Detail
              label="Reasoning correct?"
              value={selected.reasoningCorrect == null ? '--' : selected.reasoningCorrect ? 'Yes' : 'No'}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}
