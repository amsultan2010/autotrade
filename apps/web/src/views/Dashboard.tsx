'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorCodes } from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { mergeOpenPositions, countOpenPositions, enrichDisplayPositions, type DisplayPosition } from '@/lib/positions';
import {
  averageSignalConfidence,
  buildConfidenceTrend,
  buildCumulativePnlSeries,
  buildSimulatorEquityCurve,
  formatHistoryLabels,
  signalRegime,
  type EquityTab,
} from '@/lib/dashboard-charts';
import { formatStrategyLabel } from '@/src/lib/formatStrategy';
import { useSubscription, useUpgradeGate } from '@/src/components/subscription/SubscriptionProvider';
import { useAuth } from '@clerk/nextjs';
import {
  useBotStatus,
  useBrokerSnapshot,
  useBrokerStatus,
  useClosedTrades,
  usePerformance,
  useSignals,
  useTrades,
  useWatchlist,
  dataApi,
  type TradeRow,
} from '@/src/hooks/data';

// ─── Convex data shapes ───────────────────────────────────────────────────────
interface ConvexBotStatus {
  mode: string;
  running: boolean;
  openTrades: number;
  paperAccount: { balance: number; equity: number } | null;
  paperTradesUsed?: number;
  paperTradesLimit?: number;
  canUsePaperTrading?: boolean;
  entitled?: boolean;
}
interface ConvexSignal {
  id?: string;
  createdAt: number;
  ticker: string;
  action: string;
  strategy: string;
  confidence: number;
  entryReason: string;
}
interface ConvexPerf {
  winRate: number;
  totalPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  dailyPnl: number;
  totalTrades: number;
  openTrades: number;
  wins?: number;
  losses?: number;
  bestTrade?: number | null;
  worstTrade?: number | null;
  avgWin?: number | null;
  avgLoss?: number | null;
  maxDrawdown?: number;
}
interface ConvexBreakdown {
  byStrategy: Array<{ key: string; trades: number; wins: number; totalPnl: number; winRate: number }>;
  bySymbol: Array<{ key: string; trades: number; wins: number; totalPnl: number; winRate: number }>;
}
interface TradeItem {
  _id: string;
  symbol: string;
  side: string;
  result: string;
  pnl?: number;
  strategy: string;
  closedAt?: number;
  openedAt?: number;
}

// ─── API data shapes ──────────────────────────────────────────────────────────
interface Quote {
  symbol: string;
  price: number | null;
  changePct: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function money(n: number | null | undefined): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pnlClass(n: number | null | undefined) {
  if (n == null) return '';
  return n >= 0 ? 'pos' : 'neg';
}

function minsAgo(ts: number | string): string {
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = Math.round((Date.now() - ms) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1m ago';
  return `${diff}m ago`;
}

// ─── Equity curve helpers (simulator fallback) ───────────────────────────────
// Live Alpaca portfolio history is fetched via /api/v1/broker/portfolio-history.

// ─── Portfolio area chart (canvas) ───────────────────────────────────────────
function PortfolioChart({ data, labels }: { data: number[]; labels: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const W = canvas!.offsetWidth * devicePixelRatio;
      const H = canvas!.offsetHeight * devicePixelRatio;
      canvas!.width = W;
      canvas!.height = H;
      const ctx = canvas!.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const pad = { t: 12, b: 28, l: 4, r: 4 };
      const innerH = H - pad.t - pad.b;
      const innerW = W - pad.l - pad.r;

      const toX = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
      const toY = (v: number) => pad.t + innerH - ((v - min) / range) * innerH;

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const y = pad.t + (innerH / 4) * g;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      }

      const labelsToDraw = labels.length >= 2 ? labels : ['', '', '', '', '', ''];
      ctx.fillStyle = 'rgba(168,190,206,0.6)';
      ctx.font = `${10 * devicePixelRatio}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      labelsToDraw.forEach((lbl, i) => {
        const x = pad.l + (i / (labelsToDraw.length - 1)) * innerW;
        ctx.fillText(lbl, x, H - 6);
      });

      const isUp = data[data.length - 1]! >= data[0]!;
      const lineColor = isUp ? '#00c896' : '#ff3b52';
      const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, isUp ? 'rgba(0,200,150,0.22)' : 'rgba(255,59,82,0.22)');
      grad.addColorStop(1, isUp ? 'rgba(0,200,150,0)' : 'rgba(255,59,82,0)');

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(data[0]!));
      for (let i = 1; i < data.length; i++) {
        const x0 = toX(i - 1), y0 = toY(data[i - 1]!);
        const x1 = toX(i), y1 = toY(data[i]!);
        const cx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
      }
      ctx.lineTo(toX(data.length - 1), H - pad.b);
      ctx.lineTo(toX(0), H - pad.b);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(data[0]!));
      for (let i = 1; i < data.length; i++) {
        const x0 = toX(i - 1), y0 = toY(data[i - 1]!);
        const x1 = toX(i), y1 = toY(data[i]!);
        const cx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.stroke();

      const lastX = toX(data.length - 1);
      const lastY = toY(data[data.length - 1]!);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = isUp ? 'rgba(0,200,150,0.4)' : 'rgba(255,59,82,0.4)';
      ctx.lineWidth = 6 * devicePixelRatio;
      ctx.stroke();
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, labels]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── Radial confidence gauge (canvas) ────────────────────────────────────────
function ConfidenceGauge({ value }: { value: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const size = canvas!.offsetWidth * devicePixelRatio;
      canvas!.width = size;
      canvas!.height = size;
      const ctx = canvas!.getContext('2d')!;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2, cy = size / 2;
      const r = size * 0.38;
      const startAngle = Math.PI * 0.75;
      const endAngle = Math.PI * 2.25;
      const fillAngle = startAngle + (endAngle - startAngle) * (value / 100);

      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = size * 0.07;
      ctx.lineCap = 'round';
      ctx.stroke();

      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      grad.addColorStop(0, '#00c896');
      grad.addColorStop(1, '#4facfe');
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, fillAngle);
      ctx.strokeStyle = grad;
      ctx.lineWidth = size * 0.07;
      ctx.lineCap = 'round';
      ctx.stroke();

      const tx = cx + r * Math.cos(fillAngle);
      const ty = cy + r * Math.sin(fillAngle);
      ctx.beginPath();
      ctx.arc(tx, ty, size * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = '#00c896';
      ctx.shadowColor = '#00c896';
      ctx.shadowBlur = size * 0.08;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#f4f8fd';
      ctx.font = `bold ${size * 0.22}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${value}%`, cx, cy - size * 0.04);

      const label = value >= 70 ? 'Very High' : value >= 50 ? 'High' : value >= 30 ? 'Medium' : 'Low';
      ctx.fillStyle = '#6a8fa8';
      ctx.font = `${size * 0.09}px Inter, sans-serif`;
      ctx.fillText(label, cx, cy + size * 0.14);
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [value]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── Sparkline from real price / PnL series ───────────────────────────────────
function DataSparkline({ values, up, width = 44, height = 22 }: { values: number[]; up: boolean; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length < 2) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v) => (v - min) / range);

    function draw() {
      const W = canvas!.offsetWidth * devicePixelRatio;
      const H = canvas!.offsetHeight * devicePixelRatio;
      canvas!.width = W;
      canvas!.height = H;
      const ctx = canvas!.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
      const color = up ? '#00c896' : '#ff3b52';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * devicePixelRatio;
      ctx.beginPath();
      pts.forEach((v, i) => {
        const x = (i / (pts.length - 1)) * W;
        const y = H - v * H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    draw();
  }, [values, up]);

  if (values.length < 2) {
    return <span className="muted" style={{ fontSize: 10, width, display: 'inline-block' }}>--</span>;
  }

  return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />;
}

// ─── Dismissible info banner ───────────────────────────────────────────────────
const ALPACA_NO_POSITIONS_BANNER_KEY = 'autotrade-dismiss-alpaca-no-positions-banner';

const dismissibleBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  margin: '0 0 12px',
  padding: '12px 14px 12px 16px',
  borderRadius: 'var(--r-sm)',
  fontSize: 14,
  lineHeight: 1.45,
  background: 'rgba(79,172,254,0.12)',
  border: '1px solid rgba(79,172,254,0.35)',
  color: 'var(--ink-2)',
};

function DismissibleInfoBanner({
  storageKey,
  children,
  style,
}: {
  storageKey: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === '1');
    setReady(true);
  }, [storageKey]);

  const dismiss = useCallback(() => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }, [storageKey]);

  if (!ready || dismissed) return null;

  return (
    <div style={{ ...dismissibleBannerStyle, ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 0,
          borderRadius: 6,
          background: 'transparent',
          color: 'inherit',
          fontSize: 20,
          lineHeight: 1,
          opacity: 0.65,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Dashboard panel with HUD corners ───────────────────────────────────────
function DbPanel({ className, children, ...rest }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className ? `db-panel ${className}` : 'db-panel'} {...rest}>
      <span className="hud-corners" aria-hidden="true" />
      {children}
    </div>
  );
}

// ─── Heatmap tile ─────────────────────────────────────────────────────────────
function HeatmapTile({ sym, pct, large }: { sym: string; pct: number; large?: boolean }) {
  const abs = Math.abs(pct);
  const intensity = Math.min(abs / 4, 1);
  const bg = pct >= 0
    ? `rgba(0,200,150,${0.15 + intensity * 0.55})`
    : `rgba(255,59,82,${0.15 + intensity * 0.55})`;
  const border = pct >= 0 ? 'rgba(0,200,150,0.3)' : 'rgba(255,59,82,0.3)';
  return (
    <div className={`db-heatmap-tile ${large ? 'large' : ''}`} style={{ background: bg, borderColor: border }}>
      <span className="db-heatmap-sym">{sym}</span>
      <span className="db-heatmap-pct" style={{ color: pct >= 0 ? '#00c896' : '#ff3b52' }}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </span>
    </div>
  );
}


interface StrategyBreakdownRow {
  key: string;
  trades: number;
  wins: number;
  totalPnl: number;
  winRate: number;
}

function buildStrategyBreakdown(trades: TradeItem[]): StrategyBreakdownRow[] {
  const map = new Map<string, { trades: number; wins: number; totalPnl: number }>();
  for (const t of trades) {
    const row = map.get(t.strategy) ?? { trades: 0, wins: 0, totalPnl: 0 };
    row.trades += 1;
    if (t.result === 'WIN') row.wins += 1;
    row.totalPnl += t.pnl ?? 0;
    map.set(t.strategy, row);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      ...v,
      winRate: v.trades > 0 ? v.wins / v.trades : 0,
      totalPnl: Math.round(v.totalPnl * 100) / 100,
    }))
    .sort((a, b) => b.trades - a.trades);
}

type ActivityItem =
  | { kind: 'trade'; id: string; at: number; symbol: string; strategy: string; result: string; pnl?: number }
  | { kind: 'signal'; id: string; at: number; symbol: string; action: string; strategy: string; confidence: number };

function buildRecentActivity(closed: TradeItem[], signalRows: ConvexSignal[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...closed.map((t) => ({
      kind: 'trade' as const,
      id: t._id,
      at: t.closedAt ?? t.openedAt ?? 0,
      symbol: t.symbol,
      strategy: t.strategy,
      result: t.result,
      pnl: t.pnl,
    })),
    ...signalRows.slice(0, 12).map((s) => ({
      kind: 'signal' as const,
      id: `${s.ticker}-${s.createdAt}`,
      at: s.createdAt,
      symbol: s.ticker,
      action: s.action,
      strategy: s.strategy,
      confidence: s.confidence,
    })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, 8);
}

function resultBadgeClass(result: string): string {
  if (result === 'WIN') return 'db-result-win';
  if (result === 'LOSS') return 'db-result-loss';
  return 'db-result-flat';
}

const ALPACA_SYNC_INTERVAL_MS = 90_000;
const ALPACA_RATE_LIMIT_BACKOFF_MS = 5 * 60_000;

function isAlpacaRateLimitMessage(message: string): boolean {
  return /\b429\b|rate limit/i.test(message);
}


// ─── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { entitlements } = useSubscription();
  const gate = useUpgradeGate();
  const showAdvanced = entitlements?.limits?.advancedAnalytics ?? false;
  const showPremium = entitlements?.limits?.premiumAnalytics ?? false;
  const { isSignedIn: isAuthenticated, isLoaded: authLoaded } = useAuth();
  const convexAuthLoading = !authLoaded;
  const { data: botStatus, refresh: refreshBotStatus } = useBotStatus();
  const botRunning = botStatus?.running === true;
  const widgetPollMs = botRunning ? 10_000 : 20_000;
  const { summary: perfData, breakdowns: breakdownData, refresh: refreshPerformance } = usePerformance({
    intervalMs: widgetPollMs,
  });
  const { data: signalRows, loading: signalsLoading, refresh: refreshSignals } = useSignals(12, {
    intervalMs: widgetPollMs,
  });
  const { data: watchlist, loading: watchlistLoading } = useWatchlist();
  const { data: closedTradeData, loading: closedTradesLoading, refresh: refreshClosedTrades } = useClosedTrades(
    200,
    { intervalMs: widgetPollMs },
  );
  const { data: tradeData, loading: tradesLoading, refresh: refreshTrades } = useTrades({
    limit: 200,
    enabled: true,
  });
  const { data: openTrades, loading: openTradesLoading, refresh: refreshOpenTrades } = useTrades({
    result: 'OPEN',
    limit: 100,
    enabled: true,
  });
  const { data: brokerStatus } = useBrokerStatus();
  const { data: brokerSnapshot, loading: snapshotLoading, refresh: refreshBrokerSnapshot } = useBrokerSnapshot();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [tab, setTab]       = useState<EquityTab>('1D');
  const [alpacaEquitySeries, setAlpacaEquitySeries] = useState<number[] | null>(null);
  const [alpacaTimestamps, setAlpacaTimestamps] = useState<number[]>([]);
  const [symbolSparklines, setSymbolSparklines] = useState<Record<string, number[]>>({});

  const refreshPortfolioWidgets = useCallback(async () => {
    await Promise.all([
      refreshBrokerSnapshot(),
      refreshOpenTrades(),
      refreshClosedTrades(),
      refreshTrades(),
      refreshPerformance(),
      refreshSignals(),
    ]);
  }, [
    refreshBrokerSnapshot,
    refreshOpenTrades,
    refreshClosedTrades,
    refreshTrades,
    refreshPerformance,
    refreshSignals,
  ]);

  const refreshPortfolioRef = useRef(refreshPortfolioWidgets);
  refreshPortfolioRef.current = refreshPortfolioWidgets;
  const alpacaBackoffUntilRef = useRef(0);

  const openPositionSymbols = (openTrades ?? []).map((t) => t.symbol.toUpperCase());
  const brokerPositionSymbols = (brokerSnapshot?.positions ?? []).map((p) => p.symbol.toUpperCase());
  const quoteSymbolsKey = [...new Set([
    ...(watchlist?.map((w) => w.symbol.toUpperCase()) ?? []),
    ...openPositionSymbols,
    ...brokerPositionSymbols,
  ])].join(',');

  // Fetch live prices for watchlist + open positions (portfolio-aware quotes).
  useEffect(() => {
    if (!quoteSymbolsKey) return;
    const fetchPrices = () => {
      fetch(`/api/v1/watchlist/quotes?symbols=${encodeURIComponent(quoteSymbolsKey)}`)
        .then((r) => r.json())
        .then((data: Quote[]) => setQuotes(data))
        .catch(() => {});
    };
    fetchPrices();
    const t = setInterval(fetchPrices, 15_000);
    return () => clearInterval(t);
  }, [quoteSymbolsKey]);

  // Sync Alpaca account snapshot when broker is connected (throttled; snapshot poll reads DB).
  const brokerConnected = brokerStatus?.connected === true;
  useEffect(() => {
    if (!brokerConnected || convexAuthLoading || !isAuthenticated) return;

    const runSync = () => {
      if (Date.now() < alpacaBackoffUntilRef.current) return;

      dataApi.syncBroker()
        .then((result) => {
          if (result.error) {
            if (isAlpacaRateLimitMessage(result.error)) {
              alpacaBackoffUntilRef.current = Date.now() + ALPACA_RATE_LIMIT_BACKOFF_MS;
              setBrokerError('Alpaca is temporarily rate limiting updates. Showing your last synced portfolio.');
            } else {
              setBrokerError(result.error);
            }
          } else {
            setBrokerError(null);
            void refreshBrokerSnapshot();
          }
        })
        .catch((err) => {
          const msg = formatUserError(err, 'Could not sync Alpaca account');
          if (isAlpacaRateLimitMessage(msg)) {
            alpacaBackoffUntilRef.current = Date.now() + ALPACA_RATE_LIMIT_BACKOFF_MS;
            setBrokerError('Alpaca is temporarily rate limiting updates. Showing your last synced portfolio.');
          } else {
            setBrokerError(msg);
          }
        });
    };

    runSync();
    const t = setInterval(runSync, ALPACA_SYNC_INTERVAL_MS);
    return () => clearInterval(t);
  }, [brokerConnected, convexAuthLoading, isAuthenticated, refreshBrokerSnapshot]);

  // Alpaca portfolio equity history for the chart (live account curve).
  useEffect(() => {
    if (!brokerConnected || convexAuthLoading || !isAuthenticated) {
      setAlpacaEquitySeries(null);
      setAlpacaTimestamps([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/v1/broker/portfolio-history?tab=${tab}`)
      .then((r) => r.json())
      .then((hist: { equity?: number[]; timestamp?: number[] } | null) => {
        if (cancelled) return;
        if (hist?.equity?.length) {
          setAlpacaEquitySeries(hist.equity);
          setAlpacaTimestamps(hist.timestamp ?? []);
        } else {
          setAlpacaEquitySeries(null);
          setAlpacaTimestamps([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAlpacaEquitySeries(null);
          setAlpacaTimestamps([]);
        }
      });

    const refreshId = setInterval(() => {
      fetch(`/api/v1/broker/portfolio-history?tab=${tab}`)
        .then((r) => r.json())
        .then((hist: { equity?: number[]; timestamp?: number[] } | null) => {
          if (cancelled) return;
          if (hist?.equity?.length) {
            setAlpacaEquitySeries(hist.equity);
            setAlpacaTimestamps(hist.timestamp ?? []);
          }
        })
        .catch(() => undefined);
    }, 120_000);

    return () => {
      cancelled = true;
      clearInterval(refreshId);
    };
  }, [brokerConnected, convexAuthLoading, isAuthenticated, tab]);

  const signals: ConvexSignal[] = (signalRows ?? []).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    ticker: s.ticker,
    action: s.action,
    strategy: s.strategy,
    confidence: s.confidence,
    entryReason: s.entryReason,
  }));

  // Mini price sparklines for signal feed tickers (real 1D candles).
  const signalTickersKey = signals.slice(0, 6).map((s) => s.ticker).join(',');
  useEffect(() => {
    if (!signalTickersKey) return;
    const tickers = signalTickersKey.split(',').filter(Boolean);
    let cancelled = false;

    const symbolsParam = tickers.map((s) => encodeURIComponent(s.toUpperCase())).join(',');
    fetch(`/api/v1/market/candles?symbols=${symbolsParam}&timeframe=1d&limit=14`)
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as { candlesBySymbol?: Record<string, Array<{ c: number }>> };
      })
      .then((json) => {
        if (cancelled || !json?.candlesBySymbol) return;
        const next: Record<string, number[]> = {};
        for (const [sym, candles] of Object.entries(json.candlesBySymbol)) {
          const closes = candles.map((c) => c.c);
          if (closes.length >= 2) next[sym] = closes;
        }
        setSymbolSparklines(next);
      })
      .catch(() => {
        if (!cancelled) setSymbolSparklines({});
      });

    return () => { cancelled = true; };
  }, [signalTickersKey]);

  async function toggle() {
    if (convexAuthLoading || !isAuthenticated) {
      setError('Connecting your session. Try again in a moment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextMode = botStatus?.running ? 'DISABLED' : 'PAPER';
      await dataApi.setBotMode(nextMode);
      await refreshBotStatus();
      await refreshPortfolioRef.current();
    } catch (err) {
      reportTrackedError(ErrorCodes.BOT, err, { route: '/dashboard', action: 'toggle' });
      setError(formatUserError(err, 'Could not change bot mode'));
    } finally {
      setBusy(false);
    }
  }

  // ── Account value ────────────────────────────────────────────────────────────
  const pa = botStatus?.paperAccount;
  const snap = brokerSnapshot;
  const hasAlpacaData = brokerConnected && snap != null;
  const showAlpacaPortfolio =
    hasAlpacaData && (!snap!.syncError || snap!.equity > 0 || snap!.cash > 0);
  const equity = showAlpacaPortfolio ? snap!.equity : (pa?.equity ?? 0);
  const balance = showAlpacaPortfolio ? snap!.cash : (pa?.balance ?? equity);
  const simulatorOpenCount = (openTrades ?? []).filter((t) => !t.brokerOrderId).length;
  const portfolioLabel = showAlpacaPortfolio
    ? `Alpaca ${snap!.mode}`
    : brokerConnected && snap?.syncError
      ? 'Alpaca (sync failed)'
      : brokerConnected && snapshotLoading
        ? 'Alpaca (syncing…)'
      : brokerConnected
        ? 'Alpaca paper'
      : simulatorOpenCount > 0
        ? `Simulator · ${simulatorOpenCount} open position${simulatorOpenCount === 1 ? '' : 's'}`
        : 'Simulator';
  const alpacaDayGain = snap?.lastEquity != null ? snap.equity - snap.lastEquity : null;
  const dayGain = alpacaDayGain ?? perfData?.dailyPnl ?? 0;
  const dayGainPct = snap?.lastEquity != null && snap.lastEquity > 0
    ? (alpacaDayGain! / snap.lastEquity) * 100
    : balance > 0
      ? (dayGain / balance) * 100
      : 0;

  // ── Performance ──────────────────────────────────────────────────────────────
  const winRate = perfData ? Math.round(perfData.winRate * 100) : 0;
  const avgConfidence = averageSignalConfidence(signals);
  const regime = signalRegime(signals);
  const confidenceTrend = buildConfidenceTrend(signals);
  const closedTrades = closedTradeData ?? [];
  const perfPnlSeries = buildCumulativePnlSeries(closedTrades);
  const recentClosedTrades = closedTrades.slice(0, 8);
  const topStrategiesFromBreakdown = [...(breakdownData?.byStrategy ?? [])]
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 5);
  const topStrategies = topStrategiesFromBreakdown.length > 0
    ? topStrategiesFromBreakdown
    : buildStrategyBreakdown(closedTrades).slice(0, 5);
  const recentActivity = buildRecentActivity(closedTrades, signals);
  const watchlistCount = watchlist?.length ?? 0;
  const buyingPower = snap?.buyingPower ?? null;

  // ── Heatmap from watchlist (user symbols + live quotes) ─────────────────────
  const watchlistSymbols = watchlist?.map((w) => w.symbol) ?? [];
  const quoteBySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q.changePct ?? 0]));
  const heatmapData = watchlistSymbols.slice(0, 10).map((sym, i) => ({
    sym,
    pct: quoteBySymbol.get(sym.toUpperCase()) ?? 0,
    large: i < 7,
  }));

  // ── Equity curve: Alpaca history when connected, else simulator from trades ─
  const rawEquitySeries =
    alpacaEquitySeries && alpacaEquitySeries.length >= 2
      ? alpacaEquitySeries
      : buildSimulatorEquityCurve(equity, tradeData ?? [], tab);
  const equityCurve = rawEquitySeries.length >= 2
    ? rawEquitySeries
    : buildSimulatorEquityCurve(Math.max(equity, 1), tradeData ?? [], tab);
  const chartLabels =
    alpacaTimestamps.length >= 2
      ? formatHistoryLabels(alpacaTimestamps, tab)
      : formatHistoryLabels([], tab);

  const perfToday = alpacaDayGain ?? perfData?.dailyPnl ?? 0;

  // ── Positions: broker snapshot + simulator open trades (same source as history)
  const positionsLoading = brokerConnected && snapshotLoading && openTradesLoading;
  const livePositionsRaw: DisplayPosition[] = mergeOpenPositions(snap?.positions ?? [], openTrades ?? []);
  const quotePricesBySymbol = Object.fromEntries(
    quotes
      .filter((q) => q.price != null && Number.isFinite(q.price))
      .map((q) => [q.symbol.toUpperCase(), q.price as number]),
  );
  const livePositions: DisplayPosition[] = enrichDisplayPositions(livePositionsRaw, quotePricesBySymbol);
  const openPositionCount = positionsLoading
    ? null
    : countOpenPositions(snap?.positions ?? [], openTrades ?? []);

  // ── Mode display ─────────────────────────────────────────────────────────────
  const modeLabel = botStatus
    ? botStatus.running
      ? `LIVE · ${botStatus.mode}`
      : botStatus.mode
    : convexAuthLoading
      ? 'Connecting…'
      : '…';

  const botControlsReady = !convexAuthLoading && isAuthenticated;
  const dataLoading = convexAuthLoading || (isAuthenticated && botStatus === undefined && watchlistLoading);

  return (
    <div className="db-root" data-tour="dashboard">
{/* Top controls */}
      <div className="db-topbar">
        <div className="db-topbar-left">
          <span className={`badge ${botStatus?.running ? 'badge-on' : 'badge-off'}`}>
            {botStatus?.running && <span className="live-dot" />}
            {modeLabel}
          </span>
          {snap && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
              Alpaca {snap.mode} · buying power {money(snap.buyingPower)}
              {snap.syncedAt && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  · synced {minsAgo(snap.syncedAt)}
                </span>
              )}
            </span>
          )}
          {brokerConnected && !snap && snapshotLoading && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Syncing Alpaca…</span>
          )}
          {brokerConnected && !snap && !snapshotLoading && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Waiting for Alpaca snapshot…</span>
          )}
        </div>
        <div className="db-topbar-right" data-tour="bot-controls">
          <button
            className={botStatus?.running ? 'btn-danger' : 'btn-primary'}
            style={{ fontSize: 13, padding: '7px 16px' }}
            disabled={busy || !botControlsReady}
            onClick={() => void toggle()}
          >
            {botStatus?.running ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </div>

      <div className="db-banner-stack">
      {error && (
        <div className="error-banner">{error}</div>
      )}
      {brokerError && (
        <div className="error-banner" style={{ margin: '0 0 12px' }}>
          {isAlpacaRateLimitMessage(brokerError)
            ? brokerError
            : `Alpaca sync: ${brokerError}`}
          {!isAlpacaRateLimitMessage(brokerError) && /unauthorized|401|403/i.test(brokerError) && (
            <span>
              {'. '}Reconnect your paper API keys in Settings (generate new keys at app.alpaca.markets if needed).
            </span>
          )}
        </div>
      )}
      {dataLoading && (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Loading your account data…</p>
      )}
      {!dataLoading && botStatus?.mode === 'DISABLED' && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(79,172,254,0.12)', borderColor: 'rgba(79,172,254,0.35)' }}>
          Bot is stopped. Tap <strong>Start Bot</strong> to begin automatic scans of your watchlist.
        </div>
      )}
      {!dataLoading && !brokerConnected && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(79,172,254,0.12)', borderColor: 'rgba(79,172,254,0.35)' }}>
          Portfolio shows the <strong>$100,000 simulator</strong>. Connect Alpaca in Settings to trade with your paper account balance.
        </div>
      )}
      {!dataLoading && brokerConnected && snap && !snap.syncError && livePositions.length === 0 && botStatus?.running && (
        <DismissibleInfoBanner storageKey={ALPACA_NO_POSITIONS_BANNER_KEY}>
          Alpaca is connected: your keys work and we can read your paper account. No open positions yet: the bot only places orders when a strategy produces an approved <strong>BUY</strong> or <strong>SHORT</strong> (not HOLD) while the bot is running.
        </DismissibleInfoBanner>
      )}
      {!dataLoading && brokerConnected && snap?.syncError && !isAlpacaRateLimitMessage(snap.syncError) && (
        <div className="error-banner" style={{ margin: '0 0 12px' }}>
          Alpaca sync failed: {snap.syncError}. Disconnect and reconnect your paper keys in Settings.
        </div>
      )}
      {!dataLoading && brokerConnected && snap?.syncError && isAlpacaRateLimitMessage(snap.syncError) && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(255,193,7,0.12)', borderColor: 'rgba(255,193,7,0.35)' }}>
          Alpaca is temporarily rate limiting updates. Your last synced portfolio is still shown.
        </div>
      )}
      </div>

      {!dataLoading && (
        <div className="db-summary-grid">
          <div className="db-summary-card">
            <span className="db-summary-label">Portfolio</span>
            <span className="db-summary-value">{equity > 0 ? money(equity) : '--'}</span>
            <span className="muted" style={{ fontSize: 11 }}>{portfolioLabel}</span>
          </div>
          <div className="db-summary-card">
            <span className="db-summary-label">Cash</span>
            <span className="db-summary-value">{balance > 0 ? money(balance) : '--'}</span>
          </div>
          <div className="db-summary-card">
            <span className="db-summary-label">Buying Power</span>
            <span className="db-summary-value">{buyingPower != null ? money(buyingPower) : '--'}</span>
          </div>
          <div className="db-summary-card">
            <span className="db-summary-label">Open Positions</span>
            <span className="db-summary-value">{positionsLoading ? '…' : (openPositionCount ?? livePositions.length)}</span>
          </div>
          <div className="db-summary-card">
            <span className="db-summary-label">Watchlist</span>
            <span className="db-summary-value">{watchlistCount}</span>
            <a href="/watchlist" className="db-view-all" style={{ marginTop: 4, fontSize: 11 }}>Manage →</a>
          </div>
          <div className="db-summary-card">
            <span className="db-summary-label">Win Rate</span>
            <span className={`db-summary-value ${winRate >= 50 ? 'pos' : winRate > 0 ? 'neg' : ''}`}>
              {perfData ? `${winRate}%` : '--'}
            </span>
            <span className="muted" style={{ fontSize: 11 }}>
              {perfData ? `${perfData.totalTrades} closed` : 'No closed trades'}
            </span>
          </div>
          {botStatus?.paperTradesLimit != null && (
            <div className="db-summary-card">
              <span className="db-summary-label">Paper Quota</span>
              <span className="db-summary-value">
                {botStatus.paperTradesUsed ?? 0}/{botStatus.paperTradesLimit}
              </span>
            </div>
          )}
          {showPremium && perfData?.maxDrawdown != null && perfData.maxDrawdown > 0 && (
            <div className="db-summary-card">
              <span className="db-summary-label">Max Drawdown</span>
              <span className="db-summary-value neg">-{money(perfData.maxDrawdown)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Row 1 ── */}
      <div className="db-grid-top">

        {/* AI Signal Feed */}
        <DbPanel className="db-signal-panel" data-tour="signals">
          <div className="db-panel-header">
            <span className="db-panel-title">AI SIGNAL FEED</span>
            <span className="db-live-badge"><span className="live-dot" />Live</span>
          </div>
          <div className="db-signal-list">
            {signals.length === 0 ? (
              <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
                No signals yet. Start the bot to generate signals.
              </p>
            ) : (
              signals.slice(0, 6).map((s) => {
                const spark = symbolSparklines[s.ticker.toUpperCase()] ?? [];
                const sparkUp = spark.length >= 2 ? spark[spark.length - 1]! >= spark[0]! : s.action === 'BUY';
                return (
                <div key={`${s.ticker}-${s.createdAt}`} className="db-signal-row">
                  <DataSparkline values={spark} up={sparkUp} />
                  <div className="db-signal-info">
                    <span className="db-signal-ticker">{s.ticker}</span>
                    <span className={`db-signal-action ${s.action === 'BUY' ? 'buy' : 'sell'}`}>
                      {s.action === 'BUY' ? '▲' : '▼'} {s.action}
                    </span>
                    <span className="db-signal-conf">
                      {s.strategy} · {Math.round(s.confidence)}%
                    </span>
                  </div>
                  <span className="db-signal-age">{minsAgo(s.createdAt)}</span>
                </div>
              );})
            )}
          </div>
          {signals.length > 0 && <span className="db-view-all muted" style={{ cursor: "default", opacity: 0.55 }}>Signals update live</span>}
        </DbPanel>

        {/* Portfolio Value */}
        <DbPanel className="db-portfolio-panel" data-tour="portfolio">
          <div className="db-panel-header">
            <span className="db-panel-title">PORTFOLIO VALUE</span>
            <div className="db-tab-group">
              {(['1D','1W','1M','3M','1Y'] as const).map(t => (
                <button key={t} className={`db-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="db-portfolio-value">{equity > 0 ? money(equity) : '--'}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{portfolioLabel}</div>
          <div className={`db-portfolio-change ${dayGain >= 0 ? 'pos' : 'neg'}`}>
            {dayGain >= 0 ? '▲' : '▼'} {Math.abs(dayGainPct).toFixed(2)}% (Today)
            <span style={{ marginLeft: 8, opacity: 0.7 }}>{dayGain >= 0 ? '+' : ''}{money(dayGain)}</span>
            {alpacaDayGain != null && (
              <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>via Alpaca</span>
            )}
          </div>
          <div className="db-chart-area">
            <PortfolioChart data={equityCurve} labels={chartLabels} />
          </div>
        </DbPanel>

        {/* AI Confidence */}
        <DbPanel className={`db-confidence-panel ${showAdvanced ? "" : "tier-locked-panel"}`} onClick={showAdvanced ? undefined : () => gate("advancedAnalytics", "Advanced analytics require Pro or Unlimited")} role={showAdvanced ? undefined : "button"} tabIndex={showAdvanced ? undefined : 0}>
          <div className="db-panel-header">
            <span className="db-panel-title">AI CONFIDENCE</span>
          </div>
          <div className="db-gauge-wrap">
            <ConfidenceGauge value={avgConfidence} />
          </div>
          <div className="db-regime-row">
            <span className="db-regime-label">Signal Regime</span>
            <span className={`db-regime-value ${regime === 'Bullish' ? 'teal' : regime === 'Bearish' ? 'neg' : ''}`}>
              {regime} {regime === 'Bullish' ? '↗' : regime === 'Bearish' ? '↘' : '→'}
            </span>
          </div>
          <div className="db-confidence-chart">
            <DataSparkline values={confidenceTrend} up={avgConfidence >= 50} width={120} height={28} />
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Win rate {perfData ? `${winRate}%` : '--'} · {signals.length} recent signal{signals.length === 1 ? '' : 's'}
          </p>
        </DbPanel>
      </div>

      {/* ── Row 1b: Strategy + recent activity ── */}
      <div className="db-grid-mid">
        <DbPanel className="db-strategy-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">CLOSED TRADES BY STRATEGY</span>
            <span className="muted" style={{ fontSize: 11 }}>{closedTrades.length} closed</span>
          </div>
          {closedTradesLoading ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>Loading closed trades…</p>
          ) : topStrategies.length === 0 ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
              No closed trades yet. Performance by strategy will appear after your first exits.
            </p>
          ) : (
            <table className="db-pos-table">
              <thead>
                <tr>
                  <th className="muted" style={{ fontSize: 10, textAlign: 'left', paddingBottom: 8 }}>Strategy</th>
                  <th className="muted" style={{ fontSize: 10, textAlign: 'right', paddingBottom: 8 }}>Trades</th>
                  <th className="muted" style={{ fontSize: 10, textAlign: 'right', paddingBottom: 8 }}>Win%</th>
                  <th className="muted" style={{ fontSize: 10, textAlign: 'right', paddingBottom: 8 }}>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {topStrategies.map((s) => (
                  <tr key={s.key} className="db-pos-row">
                    <td className="db-pos-ticker" style={{ fontSize: 12 }}>{formatStrategyLabel(s.key)}</td>
                    <td className="db-pos-value" style={{ textAlign: 'right' }}>{s.trades}</td>
                    <td className="db-pos-value" style={{ textAlign: 'right' }}>{Math.round(s.winRate * 100)}%</td>
                    <td className={`db-pos-pnl ${s.totalPnl >= 0 ? 'pos' : 'neg'}`} style={{ textAlign: 'right' }}>
                      {s.totalPnl >= 0 ? '+' : ''}{money(s.totalPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DbPanel>

        <DbPanel className="db-recent-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">RECENT ACTIVITY</span>
          </div>
          {closedTradesLoading && signalsLoading ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>Loading activity…</p>
          ) : recentActivity.length === 0 ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
              No activity yet. Start the bot to generate signals and trades.
            </p>
          ) : (
            <div className="db-activity-list">
              {recentActivity.map((item) => (
                item.kind === 'trade' ? (
                  <div key={item.id} className="db-activity-row">
                    <div className="db-activity-main">
                      <span className="db-activity-symbol">{item.symbol}</span>
                      <span className={`db-result-pill ${resultBadgeClass(item.result)}`}>{item.result}</span>
                    </div>
                    <div className="db-activity-meta">
                      <span>{formatStrategyLabel(item.strategy)}</span>
                      <span className="muted">· {minsAgo(item.at)}</span>
                    </div>
                    <span className={`db-activity-pnl ${(item.pnl ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                      {(item.pnl ?? 0) >= 0 ? '+' : ''}{money(item.pnl)}
                    </span>
                  </div>
                ) : (
                  <div key={item.id} className="db-activity-row db-activity-signal">
                    <div className="db-activity-main">
                      <span className="db-activity-symbol">{item.symbol}</span>
                      <span className={`db-signal-action ${item.action === 'BUY' ? 'buy' : 'sell'}`}>{item.action}</span>
                    </div>
                    <div className="db-activity-meta">
                      <span>{formatStrategyLabel(item.strategy)}</span>
                      <span className="muted">· {Math.round(item.confidence)}% · {minsAgo(item.at)}</span>
                    </div>
                    <span className="db-activity-tag muted">Signal</span>
                  </div>
                )
              ))}
            </div>
          )}
          <a href="/history" className="db-view-all">Full trade history →</a>
        </DbPanel>
      </div>

      {/* ── Row 2 ── */}
      <div className="db-grid-bottom">

        {/* Positions */}
        <DbPanel className="db-positions-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">
              POSITIONS ({positionsLoading ? '…' : (openPositionCount ?? livePositions.length)})
            </span>
          </div>
          {positionsLoading ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>Loading positions…</p>
          ) : livePositions.length === 0 ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
              No open positions.
              {!brokerConnected
                ? ' Connect Alpaca in Settings for broker-backed paper trading, or start the bot to open simulator trades.'
                : ' Start the bot to open trades on your watchlist.'}
            </p>
          ) : (
            <table className="db-pos-table">
              <tbody>
                {livePositions.map((p) => {
                  const pnl = p.unrealizedPnl ?? 0;
                  const pnlPct = p.unrealizedPnlPct ?? 0;
                  return (
                    <tr key={p.tradeId ?? p.symbol} className="db-pos-row">
                      <td className="db-pos-ticker">{p.symbol}</td>
                      <td className={`db-pos-side ${p.side === 'LONG' ? 'buy' : 'sell'}`}>{p.side === 'LONG' ? 'Long' : 'Short'}</td>
                      <td className="db-pos-value">
                        {p.marketValue != null ? money(p.marketValue) : `${p.qty} @ ${money(p.avgEntryPrice)}`}
                      </td>
                      <td className={`db-pos-pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${money(pnl)}` : '--'}</td>
                      <td className={`db-pos-pct ${pnlPct >= 0 ? 'pos' : 'neg'}`}>{pnlPct !== 0 ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <a href="/history" className="db-view-all">View trade history →</a>
        </DbPanel>

        {/* Market Heatmap */}
        <DbPanel className="db-heatmap-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">MARKET HEATMAP</span>
          </div>
          <div className="db-heatmap-grid">
            {heatmapData.length === 0 ? (
              <p className="muted" style={{ padding: '1rem 0', fontSize: 13, gridColumn: '1 / -1' }}>
                Add symbols to your Watchlist to see live market heatmap.
              </p>
            ) : (
              <>
                {heatmapData.slice(0, 7).map((t) => (
                  <HeatmapTile key={t.sym} sym={t.sym} pct={t.pct} large={t.large} />
                ))}
                {heatmapData.slice(7).map((t) => (
                  <HeatmapTile key={t.sym} sym={t.sym} pct={t.pct} />
                ))}
              </>
            )}
          </div>
        </DbPanel>

        {/* Performance */}
        <DbPanel className="db-perf-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">PERFORMANCE</span>
          </div>
          <div className="db-perf-list">
            <div className="db-perf-row">
              <span className="db-perf-label">Today</span>
              <span className={`db-perf-value ${pnlClass(perfToday)}`}>
                {perfData || alpacaDayGain != null ? `${perfToday >= 0 ? '+' : ''}${money(perfToday)}` : '--'}
              </span>
            </div>
            <div className="db-perf-row">
              <span className="db-perf-label">This Week</span>
              <span className={`db-perf-value ${pnlClass(perfData?.weeklyPnl)}`}>
                {perfData ? `${perfData.weeklyPnl >= 0 ? '+' : ''}${money(perfData.weeklyPnl)}` : '--'}
              </span>
            </div>
            <div className="db-perf-row">
              <span className="db-perf-label">This Month</span>
              <span className={`db-perf-value ${pnlClass(perfData?.monthlyPnl)}`}>
                {perfData ? `${perfData.monthlyPnl >= 0 ? '+' : ''}${money(perfData.monthlyPnl)}` : '--'}
              </span>
            </div>
            <div className="db-perf-row">
              <span className="db-perf-label">All Time</span>
              <span className={`db-perf-value ${pnlClass(perfData?.totalPnl)}`}>
                {perfData ? `${perfData.totalPnl >= 0 ? '+' : ''}${money(perfData.totalPnl)}` : '--'}
              </span>
            </div>
          </div>
          <div className="db-perf-sparkline">
            <DataSparkline values={perfPnlSeries} up={(perfData?.totalPnl ?? 0) >= 0} width={120} height={28} />
          </div>
          <div className="db-perf-stats">
            <div className="db-perf-stat">
              <span className="db-perf-stat-label">Win Rate</span>
              <span className={`db-perf-stat-value ${winRate >= 50 ? 'pos' : 'neg'}`}>
                {perfData ? `${winRate}%` : '--'}
              </span>
            </div>
            <div className="db-perf-stat">
              <span className="db-perf-stat-label">Total Trades</span>
              <span className="db-perf-stat-value">{perfData?.totalTrades ?? '--'}</span>
            </div>
            <div className="db-perf-stat">
              <span className="db-perf-stat-label">Open</span>
              <span className="db-perf-stat-value">{openPositionCount ?? '…'}</span>
            </div>
          </div>
        </DbPanel>
      </div>
    </div>
  );
}
