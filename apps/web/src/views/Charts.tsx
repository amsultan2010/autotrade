'use client';

import { useEffect, useState } from 'react';
import { TIMEFRAMES, type Candle, type Timeframe, ErrorCodes } from '@autotrade/shared';
import { api } from '../api/client';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { PriceChart, type ChartMarker } from '../components/PriceChart';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '@clerk/nextjs';
import { useWatchlist, useTrades } from '@/src/hooks/data';
import {
  PageShell,
  PageHeader,
  Panel,
  EmptyState,
  SegmentedControl,
  AlertBanner,
  StatCard,
} from '@/src/components/layout/PageShell';
import {
  ForgeInstrumentRack,
  ForgeChartBezel,
  ForgeDial,
} from '@/src/components/forge/ForgeInstruments';
import { ForgeLCD } from '@/src/components/forge/ForgePrimitives';
import { cn } from '@/lib/utils';

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

const selectClassName = cn(
  'forge-inset h-10 min-w-[140px] rounded-lg border border-border-strong bg-surface px-3 py-2',
  'font-mono text-sm text-ink',
  'transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
);

export function Charts() {
  const { isSignedIn: isAuthenticated, isLoaded: authLoaded } = useAuth();
  const authLoading = !authLoaded;
  const { data: watchlist } = useWatchlist();
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = (watchlist as Array<{ symbol: string }> | undefined)?.map((w) => w.symbol) ?? [];

  useEffect(() => {
    if (symbols.length > 0 && !symbol) {
      setSymbol(symbols[0]!);
    }
  }, [symbols, symbol]);

  const { data: tradeItems } = useTrades({ symbol: symbol || undefined, limit: 200 });
  const markers = tradeItems ? buildMarkers(tradeItems) : [];

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

  const lastClose = candles.length > 0 ? candles[candles.length - 1]!.c : null;
  const firstOpen = candles.length > 0 ? candles[0]!.o : null;
  const changePct =
    lastClose != null && firstOpen != null && firstOpen !== 0
      ? ((lastClose - firstOpen) / firstOpen) * 100
      : null;
  const high = candles.length > 0 ? Math.max(...candles.map((c) => c.h)) : null;
  const low = candles.length > 0 ? Math.min(...candles.map((c) => c.l)) : null;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className={selectClassName}
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        aria-label="Symbol"
      >
        {symbols.length === 0 && <option value="">No symbols — add some on Watchlist</option>}
        {symbols.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <SegmentedControl
        options={TIMEFRAMES}
        value={tf}
        onChange={setTf}
        size="sm"
      />
    </div>
  );

  return (
    <PageShell>
      <PageHeader title="Charts" code="SYS://CHARTS" actions={headerActions} />

      {symbol && candles.length > 0 && (
        <ForgeInstrumentRack title="Market telemetry" code="FEED://OHLCV" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ForgeLCD label="Symbol" value={symbol} variant="teal" />
            <ForgeLCD
              label="Last"
              value={lastClose != null ? lastClose.toFixed(2) : '--'}
              unit="USD"
              variant="teal"
            />
            <div className="forge-inset flex items-center justify-center rounded-lg p-3">
              <ForgeDial
                label="Range Δ"
                value={changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}` : '--'}
                unit="%"
                pct={changePct != null ? Math.min(100, Math.abs(changePct) * 10) : 0}
                color={changePct != null && changePct >= 0 ? '#34d399' : '#f87171'}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ForgeLCD label="High" value={high != null ? high.toFixed(2) : '--'} variant="amber" />
              <ForgeLCD label="Low" value={low != null ? low.toFixed(2) : '--'} variant="red" />
            </div>
          </div>
        </ForgeInstrumentRack>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Timeframe" value={tf} variant="teal" />
        <StatCard label="Candles" value={candles.length || '--'} hint={loading ? 'Refreshing…' : 'OHLCV bars'} />
        <StatCard label="Trade markers" value={markers.length} hint="Entries & exits on chart" />
      </div>

      <Panel className="mt-2">
        {authLoading || (isAuthenticated && watchlist == null) ? (
          <div aria-label="Loading" role="status" className="space-y-4">
            <Skeleton height={28} width="40%" />
            <Skeleton height={320} width="100%" />
          </div>
        ) : !symbol ? (
          <EmptyState
            title="No symbol selected"
            description="Add symbols on the Watchlist tab, then pick one here to see its chart."
          />
        ) : error ? (
          <AlertBanner variant="error">{error}</AlertBanner>
        ) : candles.length === 0 ? (
          <div aria-label="Loading chart" role="status" className="space-y-4">
            <Skeleton height={28} width="35%" />
            <Skeleton height={320} width="100%" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              <span className="font-mono font-semibold text-ink">{symbol}</span>
              {' · '}
              {tf}
              {' · '}
              <span className="tabular-nums">{candles.length}</span> candles
              {markers.length > 0 && (
                <span>
                  {' · '}
                  <span className="tabular-nums">{markers.length}</span> trade markers
                </span>
              )}
              {loading && <span> · refreshing…</span>}
            </p>

            <ForgeChartBezel label={`Candlestick feed · ${symbol} · ${tf}`}>
              <PriceChart candles={candles} markers={markers} />
            </ForgeChartBezel>

            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-positive" aria-hidden />
                up candle
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-negative" aria-hidden />
                down candle
              </span>
              <span>▲ long entry · ▼ short entry · ● exit</span>
            </div>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
