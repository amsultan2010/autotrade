import { useEffect, useState } from 'react';
import type { TradeDTO } from '@autotrade/shared';
import { api } from '../api/client';

function money(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function TradeHistory() {
  const [trades, setTrades] = useState<TradeDTO[]>([]);
  const [selected, setSelected] = useState<TradeDTO | null>(null);
  const [filter, setFilter] = useState<'all' | 'OPEN' | 'WIN' | 'LOSS'>('all');
  const [closingId, setClosingId] = useState<string | null>(null);

  async function load() {
    const params = filter === 'all' ? '' : `?result=${filter}`;
    const { items } = await api.getTrades(params);
    setTrades(items);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function closeNow(id: string) {
    setClosingId(id);
    try {
      await api.closeTrade(id);
      await load();
    } catch {
      /* ignore */
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Trade History</h1>
        <div className="seg small">
          {(['all', 'OPEN', 'WIN', 'LOSS'] as const).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="split">
        <section className="panel grow">
          {trades.length === 0 ? (
            <p className="muted">No trades match this filter yet.</p>
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
                  <tr key={t.id} className={selected?.id === t.id ? 'row-sel' : ''} onClick={() => setSelected(t)}>
                    <td className="muted">{new Date(t.openedAt).toLocaleString()}</td>
                    <td className="mono">{t.symbol}</td>
                    <td>{t.side}</td>
                    <td>
                      <span className="tag">{t.mode}</span>
                    </td>
                    <td>{money(t.entryPrice)}</td>
                    <td>{money(t.exitPrice)}</td>
                    <td className={t.pnl == null ? '' : t.pnl >= 0 ? 'pos' : 'neg'}>{money(t.pnl)}</td>
                    <td>
                      <span className={`pill pill-${t.result.toLowerCase()}`}>{t.result}</span>
                    </td>
                    <td className="right">
                      {t.result === 'OPEN' && (
                        <button
                          className="btn-text danger"
                          disabled={closingId === t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void closeNow(t.id);
                          }}
                        >
                          {closingId === t.id ? 'Closing…' : 'Close'}
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
              <button className="btn-text" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <Detail label="Strategy" value={selected.strategy} />
            <Detail label="Confidence" value={`${Math.round(selected.confidence)}%`} />
            <Detail label="Side / Mode" value={`${selected.side} · ${selected.mode}`} />
            <Detail label="Qty" value={String(selected.qty)} />
            <Detail label="Entry / Exit" value={`${money(selected.entryPrice)} → ${money(selected.exitPrice)}`} />
            <Detail label="Stop / Target" value={`${money(selected.stopLoss)} / ${money(selected.takeProfit)}`} />
            <Detail label="P/L" value={money(selected.pnl)} />
            <Detail label="Entry reason" value={selected.entryReason} />
            <Detail label="Exit reason" value={selected.exitReason ?? '—'} />
            <Detail
              label="Mistake tags"
              value={selected.mistakeTags.length ? selected.mistakeTags.join(', ') : 'none'}
            />
            <Detail
              label="Reasoning correct?"
              value={selected.reasoningCorrect == null ? '—' : selected.reasoningCorrect ? 'Yes' : 'No'}
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
