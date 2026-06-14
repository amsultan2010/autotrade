'use client';
import { useEffect, useState } from 'react';
import { TIMEFRAMES, type Candle, type Timeframe, type TradeDTO } from '@autotrade/shared';
import { api } from '../api/client';
import { PriceChart, type ChartMarker } from '../components/PriceChart';

function tradesToMarkers(trades: TradeDTO[]): ChartMarker[] {
  const m: ChartMarker[] = [];
  for (const t of trades) {
    const long = t.side === 'LONG';
    m.push({
      time: Date.parse(t.openedAt),
      position: long ? 'belowBar' : 'aboveBar',
      color: long ? '#34d399' : '#f87171',
      shape: long ? 'arrowUp' : 'arrowDown',
      text: `${t.side} ${t.entryPrice}`,
    });
    if (t.closedAt && t.exitPrice != null) {
      m.push({
        time: Date.parse(t.closedAt),
        position: long ? 'aboveBar' : 'belowBar',
        color: '#8595b3',
        shape: 'circle',
        text: `exit ${t.exitPrice}`,
      });
    }
  }
  return m;
}

export function Charts() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [markers, setMarkers] = useState<ChartMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const wl = await api.getWatchlist();
        const syms = wl.map((w) => w.symbol);
        setSymbols(syms);
        setSymbol((cur) => cur || syms[0] || '');
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, t] = await Promise.all([
          api.getCandles(symbol, tf),
          api.getTrades(`?symbol=${encodeURIComponent(symbol)}&limit=200`),
        ]);
        if (cancelled) return;
        setCandles(c.candles);
        setMarkers(tradesToMarkers(t.items));
      } catch {
        if (!cancelled) {
          setError('Could not load chart data for this symbol/timeframe.');
          setCandles([]);
          setMarkers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, tf]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Charts</h1>
        <div className="row gap">
          <select className="chart-select" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbols.length === 0 && <option value="">No symbols — add some on Watchlist</option>}
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="seg small">
            {TIMEFRAMES.map((t) => (
              <button key={t} className={tf === t ? 'active' : ''} onClick={() => setTf(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="panel">
        {!symbol ? (
          <p className="muted">Add symbols on the Watchlist tab, then pick one here to see its chart.</p>
        ) : error ? (
          <p className="muted">{error}</p>
        ) : candles.length === 0 ? (
          <p className="muted">{loading ? 'Loading chart…' : 'No candle data for this timeframe yet.'}</p>
        ) : (
          <>
            <div className="chart-meta">
              <span className="mono">{symbol}</span> · {tf} · {candles.length} candles
              {markers.length > 0 && <span className="muted"> · {markers.length} trade markers</span>}
              {loading && <span className="muted"> · refreshing…</span>}
            </div>
            <PriceChart candles={candles} markers={markers} />
            <div className="chart-legend">
              <span><i className="sw up" /> up candle</span>
              <span><i className="sw down" /> down candle</span>
              <span>▲ long entry · ▼ short entry · ● exit</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
