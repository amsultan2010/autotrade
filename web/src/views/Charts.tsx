'use client';
import { useEffect, useState } from 'react';
import { useQuery, useConvexAuth } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import { TIMEFRAMES, type Candle, type Timeframe, ErrorCodes } from '@autotrade/shared';
import { api } from '../api/client';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { PriceChart, type ChartMarker } from '../components/PriceChart';

function buildMarkers(trades: Array<{
  openedAt: number;
  closedAt?: number;
  side: string;
  entryPrice: number;
  exitPrice?: number;
}>): ChartMarker[] {
  const m: ChartMarker[] = [];
  for (const t of trades) {
    const long = t.side === 'LONG';
    m.push({
      time: t.openedAt,
      position: long ? 'belowBar' : 'aboveBar',
      color: long ? '#34d399' : '#f87171',
      shape: long ? 'arrowUp' : 'arrowDown',
      text: `${t.side} ${t.entryPrice}`,
    });
    if (t.closedAt && t.exitPrice != null) {
      m.push({
        time: t.closedAt,
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
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const watchlist = useQuery(convexApi.watchlist.list);
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = (watchlist as Array<{ symbol: string }> | undefined)?.map((w) => w.symbol) ?? [];

  // Set the default symbol once the watchlist loads.
  useEffect(() => {
    if (symbols.length > 0 && !symbol) {
      setSymbol(symbols[0]!);
    }
  }, [symbols, symbol]);

  // Query trades for the selected symbol.
  const tradeData = useQuery(
    convexApi.trades.list,
    symbol ? { symbol, limit: 200 } : 'skip',
  );
  const markers = tradeData ? buildMarkers(tradeData.items) : [];

  // Fetch candles from the market API whenever symbol/timeframe changes.
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getCandles(symbol, tf)
      .then((c) => { if (!cancelled) setCandles(c.candles); })
      .catch((err) => {
        if (!cancelled) {
          reportTrackedError(ErrorCodes.MARKET_DATA, err, { route: '/charts', action: 'getCandles', symbol, tf });
          setError(formatUserError(err, 'Could not load chart data for this symbol/timeframe.'));
          setCandles([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, tf]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Charts</h1>
        <div className="row gap">
          <select className="chart-select" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbols.length === 0 && <option value="">No symbols - add some on Watchlist</option>}
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="seg small">
            {TIMEFRAMES.map((t) => (
              <button key={t} className={tf === t ? 'active' : ''} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
        </div>
      </header>

      <section className="panel">
        {convexAuthLoading || (isAuthenticated && watchlist === undefined) ? (
          <p className="muted">Loading your watchlist…</p>
        ) : !symbol ? (
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
