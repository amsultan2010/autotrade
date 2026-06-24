'use client';
import { useEffect, useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { TableSkeleton } from '../components/Skeleton';

type TradeResult = 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';

interface ConvexTrade {
  _id: Id<'trades'>;
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
  mistakeTags: string[];
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const brokerStatus = useQuery(convexApi.brokerCredential.status);
  const tradeData = useQuery(convexApi.trades.list, {
    result: filter === 'all' ? undefined : filter,
  }) as { items: ConvexTrade[]; nextCursor: string | null } | undefined;
  const closeAtMarket = useAction(convexApi.tradeActions.closeAtMarket);
  const syncBroker = useAction(convexApi.brokerSyncActions.sync);

  useEffect(() => {
    if (brokerStatus?.connected) {
      syncBroker({}).catch(() => {});
    }
  }, [brokerStatus?.connected, syncBroker]);

  const trades: ConvexTrade[] = tradeData?.items ?? [];
  const selected = trades.find((t) => t._id === selectedId) ?? null;

  async function closeNow(id: Id<'trades'>) {
    setClosingId(id);
    try {
      await closeAtMarket({ id });
    } catch { /* ignore */ } finally {
      setClosingId(null);
    }
  }

  return (
    <div className="page" data-tour="trade-history">
      <header className="page-head">
        <h1>Trade History</h1>
        <div className="seg small" role="tablist" aria-label="Filter trades">
          {(['all', 'OPEN', 'WIN', 'LOSS'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </header>

      {brokerStatus?.connected && (
        <p className="muted" style={{ marginBottom: '0.75rem', fontSize: 13 }}>
          {trades.filter((t) => t.result === 'OPEN').length} open position(s) ·{' '}
          {trades.length} total trade(s) in history
          {brokerStatus.paper ? ' (Alpaca paper)' : ' (Alpaca live)'}.
          Dashboard positions and this list use the same Convex trade records.
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
              value={selected.mistakeTags.length ? selected.mistakeTags.join(', ') : 'none'}
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
