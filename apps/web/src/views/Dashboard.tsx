'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorCodes } from '@autotrade/shared';
import { cn } from '@/lib/utils';
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
  useDashboardFeed,
  dataApi,
} from '@/src/hooks/data';
import {
  PageShell,
  PageHeader,
  StatCard,
  Panel,
  Badge,
  SegmentedControl,
  AlertBanner,
  EmptyState,
  DataTable,
} from '@/src/components/layout/PageShell';
import { Button } from '@/src/components/ui/button';
import { DashboardSkeleton } from '@/src/components/DashboardSkeleton';
import {
  ForgeInstrumentRack,
  ForgeTelemetryRow,
  ForgeBarChart,
  ForgeDonut,
  ForgeChartBezel,
  ForgeMeterBank,
} from '@/src/components/forge/ForgeInstruments';

// ─── Dashboard data shapes ────────────────────────────────────────────────────
interface BotStatusSnapshot {
  mode: string;
  running: boolean;
  openTrades: number;
  paperAccount: { balance: number; equity: number } | null;
  paperTradesUsed?: number;
  paperTradesLimit?: number;
  canUsePaperTrading?: boolean;
  entitled?: boolean;
}
interface SignalSnapshot {
  id?: string;
  createdAt: number;
  ticker: string;
  action: string;
  strategy: string;
  confidence: number;
  entryReason: string;
}
interface PerfSnapshot {
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
interface BreakdownSnapshot {
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

const EQUITY_TABS = ['1D', '1W', '1M', '3M', '1Y'] as const;
const POS_COLOR = '#34d399';
const NEG_COLOR = '#f87171';
const ACCENT_COLOR = '#38bdf8';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function money(n: number | null | undefined): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pnlClass(n: number | null | undefined): string {
  if (n == null) return '';
  return n >= 0 ? 'text-positive' : 'text-negative';
}

function minsAgo(ts: number | string): string {
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = Math.round((Date.now() - ms) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1m ago';
  return `${diff}m ago`;
}

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
      const lineColor = isUp ? POS_COLOR : NEG_COLOR;
      const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, isUp ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)');
      grad.addColorStop(1, isUp ? 'rgba(52,211,153,0)' : 'rgba(248,113,113,0)');

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
      ctx.strokeStyle = isUp ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)';
      ctx.lineWidth = 6 * devicePixelRatio;
      ctx.stroke();
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, labels]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
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
      grad.addColorStop(0, POS_COLOR);
      grad.addColorStop(1, ACCENT_COLOR);
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
      ctx.fillStyle = ACCENT_COLOR;
      ctx.shadowColor = ACCENT_COLOR;
      ctx.shadowBlur = size * 0.08;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#f4f8fd';
      ctx.font = `bold ${size * 0.22}px "Chakra Petch", sans-serif`;
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

  return <canvas ref={canvasRef} className="h-full w-full" />;
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
      const color = up ? POS_COLOR : NEG_COLOR;
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
    return <span className="inline-block text-[10px] text-ink-muted" style={{ width }}>--</span>;
  }

  return <canvas ref={canvasRef} className="block" style={{ width, height }} />;
}

// ─── Dismissible info banner ───────────────────────────────────────────────────
const ALPACA_NO_POSITIONS_BANNER_KEY = 'autotrade-dismiss-alpaca-no-positions-banner';

function DismissibleInfoBanner({
  storageKey,
  children,
}: {
  storageKey: string;
  children: React.ReactNode;
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
    <AlertBanner variant="info" onDismiss={dismiss}>
      {children}
    </AlertBanner>
  );
}

// ─── Heatmap tile ─────────────────────────────────────────────────────────────
function HeatmapTile({ sym, pct, large }: { sym: string; pct: number; large?: boolean }) {
  const abs = Math.abs(pct);
  const intensity = Math.min(abs / 4, 1);
  const isUp = pct >= 0;
  const bg = isUp
    ? `rgba(52,211,153,${0.15 + intensity * 0.55})`
    : `rgba(248,113,113,${0.15 + intensity * 0.55})`;
  const border = isUp ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)';

  return (
    <div
      className={cn(
        'forge-inset flex flex-col items-center justify-center rounded-md border p-2 text-center',
        large ? 'min-h-[72px]' : 'min-h-[52px]',
      )}
      style={{ background: bg, borderColor: border }}
    >
      <span className="font-mono text-xs font-bold text-ink">{sym}</span>
      <span className={cn('font-mono text-xs font-semibold tabular-nums', isUp ? 'text-positive' : 'text-negative')}>
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

function buildRecentActivity(closed: TradeItem[], signalRows: SignalSnapshot[]): ActivityItem[] {
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

function resultBadgeVariant(result: string): 'success' | 'danger' | 'muted' {
  if (result === 'WIN') return 'success';
  if (result === 'LOSS') return 'danger';
  return 'muted';
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
  const authLoading = !authLoaded;
  const {
    data: feed,
    loading: feedLoading,
    refresh: refreshFeed,
  } = useDashboardFeed({ intervalMs: 15_000 });
  const botStatus = feed?.botStatus;
  const botRunning = botStatus?.running === true;
  const perfData = feed?.performance.summary;
  const breakdownData = feed?.performance.breakdowns;
  const signalRows = feed?.signals;
  const signalsLoading = feedLoading;
  const watchlist = feed?.watchlist;
  const watchlistLoading = feedLoading;
  const closedTradeData = feed?.closedTrades;
  const closedTradesLoading = feedLoading;
  const tradeData = feed?.trades;
  const tradesLoading = feedLoading;
  const openTrades = feed?.openTrades;
  const openTradesLoading = feedLoading;
  const brokerStatus = feed?.brokerStatus;
  const brokerSnapshot = feed?.brokerSnapshot;
  const snapshotLoading = feedLoading;
  const quotes = feed?.quotes ?? [];

  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [tab, setTab]       = useState<EquityTab>('1D');
  const [alpacaEquitySeries, setAlpacaEquitySeries] = useState<number[] | null>(null);
  const [alpacaTimestamps, setAlpacaTimestamps] = useState<number[]>([]);
  const [symbolSparklines, setSymbolSparklines] = useState<Record<string, number[]>>({});

  const refreshPortfolioWidgets = useCallback(async () => {
    await refreshFeed();
  }, [refreshFeed]);

  const refreshPortfolioRef = useRef(refreshPortfolioWidgets);
  refreshPortfolioRef.current = refreshPortfolioWidgets;
  const alpacaBackoffUntilRef = useRef(0);

  // Sync Alpaca account snapshot when broker is connected (throttled; snapshot poll reads DB).
  const brokerConnected = brokerStatus?.connected === true;
  useEffect(() => {
    if (!brokerConnected || authLoading || !isAuthenticated) return;

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
            void refreshFeed();
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
  }, [brokerConnected, authLoading, isAuthenticated, refreshFeed]);

  // Alpaca portfolio equity history for the chart (live account curve).
  useEffect(() => {
    if (!brokerConnected || authLoading || !isAuthenticated) {
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
  }, [brokerConnected, authLoading, isAuthenticated, tab]);

  const signals: SignalSnapshot[] = (signalRows ?? []).map((s) => ({
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
    if (authLoading || !isAuthenticated) {
      setError('Connecting your session. Try again in a moment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextMode = botStatus?.running ? 'DISABLED' : 'PAPER';
      await dataApi.setBotMode(nextMode);
      await refreshFeed();
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
    : authLoading
      ? 'Connecting…'
      : '…';

  const botControlsReady = !authLoading && isAuthenticated;
  const dataLoading = authLoading || (isAuthenticated && botStatus === undefined && watchlistLoading);

  return (
    <PageShell data-tour="dashboard">
      <PageHeader
        title="Dashboard"
        code="SYS://COMMAND"
        description="Live portfolio, signals, and bot controls at a glance."
        actions={
          <div data-tour="bot-controls" className="w-full sm:w-auto">
            <Button
              variant={botRunning ? 'destructive' : 'default'}
              size="sm"
              className="w-full min-h-[44px] sm:w-auto"
              disabled={busy || !botControlsReady}
              onClick={() => void toggle()}
            >
              {botRunning ? 'Stop Bot' : 'Start Bot'}
            </Button>
          </div>
        }
      />

      {/* Top status bar */}
      <div className="mobile-chip-row mb-5 md:mb-6 md:flex md:flex-wrap md:items-center md:gap-2">
        <Badge variant={botRunning ? 'success' : 'muted'} pulse={botRunning}>
          {modeLabel}
        </Badge>
        {snap && (
          <span className="text-xs text-ink-secondary">
            Alpaca {snap.mode} · buying power {money(snap.buyingPower)}
            {snap.syncedAt && (
              <span className="ml-1.5 opacity-60">· synced {minsAgo(snap.syncedAt)}</span>
            )}
          </span>
        )}
        {brokerConnected && !snap && snapshotLoading && (
          <span className="text-xs text-ink-secondary">Syncing Alpaca…</span>
        )}
        {brokerConnected && !snap && !snapshotLoading && (
          <span className="text-xs text-ink-secondary">Waiting for Alpaca snapshot…</span>
        )}
      </div>

      {/* Banners */}
      <div className="mb-6 flex flex-col gap-3">
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {brokerError && (
          <AlertBanner variant={isAlpacaRateLimitMessage(brokerError) ? 'warning' : 'error'}>
            {isAlpacaRateLimitMessage(brokerError)
              ? brokerError
              : `Alpaca sync: ${brokerError}`}
            {!isAlpacaRateLimitMessage(brokerError) && /unauthorized|401|403/i.test(brokerError) && (
              <span>
                {'. '}Reconnect your paper API keys in Settings (generate new keys at app.alpaca.markets if needed).
              </span>
            )}
          </AlertBanner>
        )}
        {dataLoading && <DashboardSkeleton />}
        {!dataLoading && botStatus?.mode === 'DISABLED' && (
          <AlertBanner variant="info">
            Bot is stopped. Tap <strong>Start Bot</strong> to begin automatic scans of your watchlist.
          </AlertBanner>
        )}
        {!dataLoading && !brokerConnected && (
          <AlertBanner variant="info">
            Portfolio shows the <strong>$100,000 simulator</strong>. Connect Alpaca in Settings to trade with your paper account balance.
          </AlertBanner>
        )}
        {!dataLoading && brokerConnected && snap && !snap.syncError && livePositions.length === 0 && botStatus?.running && (
          <DismissibleInfoBanner storageKey={ALPACA_NO_POSITIONS_BANNER_KEY}>
            Alpaca is connected: your keys work and we can read your paper account. No open positions yet: the bot only places orders when a strategy produces an approved <strong>BUY</strong> or <strong>SHORT</strong> (not HOLD) while the bot is running.
          </DismissibleInfoBanner>
        )}
        {!dataLoading && brokerConnected && snap?.syncError && !isAlpacaRateLimitMessage(snap.syncError) && (
          <AlertBanner variant="error">
            Alpaca sync failed: {snap.syncError}. Disconnect and reconnect your paper keys in Settings.
          </AlertBanner>
        )}
        {!dataLoading && brokerConnected && snap?.syncError && isAlpacaRateLimitMessage(snap.syncError) && (
          <AlertBanner variant="warning">
            Alpaca is temporarily rate limiting updates. Your last synced portfolio is still shown.
          </AlertBanner>
        )}
      </div>

      {/* Instrument telemetry rack */}
      {!dataLoading && (
        <ForgeInstrumentRack title="Command telemetry" code="SYS://COMMAND">
          <ForgeTelemetryRow
            scanLoad={botRunning ? 78 : 12}
            winRate={winRate}
            exposure={Math.min(100, Math.round(((openPositionCount ?? livePositions.length) / Math.max(1, watchlistCount || 1)) * 100))}
            signalCount={signals.length}
            equityLabel="Net equity"
            equityValue={equity > 0 ? money(equity).replace('$', '') : '--'}
          />
        </ForgeInstrumentRack>
      )}

      {/* Stat cards */}
      {!dataLoading && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Portfolio"
            value={equity > 0 ? money(equity) : '--'}
            hint={portfolioLabel}
          />
          <StatCard
            label="Cash"
            value={balance > 0 ? money(balance) : '--'}
          />
          <StatCard
            label="Buying Power"
            value={buyingPower != null ? money(buyingPower) : '--'}
          />
          <StatCard
            label="Open Positions"
            value={positionsLoading ? '…' : (openPositionCount ?? livePositions.length)}
          />
          <StatCard
            label="Watchlist"
            value={watchlistCount}
            hint={
              <a href="/watchlist" className="text-accent hover:underline">
                Manage →
              </a>
            }
          />
          <StatCard
            label="Win Rate"
            value={perfData ? `${winRate}%` : '--'}
            trend={winRate >= 50 ? 'up' : winRate > 0 ? 'down' : 'neutral'}
            hint={perfData ? `${perfData.totalTrades} closed` : 'No closed trades'}
          />
          {botStatus?.paperTradesLimit != null && (
            <StatCard
              label="Paper Quota"
              value={`${botStatus.paperTradesUsed ?? 0}/${botStatus.paperTradesLimit}`}
            />
          )}
          {showPremium && perfData?.maxDrawdown != null && perfData.maxDrawdown > 0 && (
            <StatCard
              label="Max Drawdown"
              value={`-${money(perfData.maxDrawdown)}`}
              trend="down"
            />
          )}
        </div>
      )}

      {/* Analytics telemetry row */}
      {!dataLoading && (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Panel title="Strategy P&L" dense>
            <ForgeChartBezel label="Closed trade distribution">
              <ForgeBarChart
                height={100}
                items={topStrategies.slice(0, 6).map((s) => ({
                  label: formatStrategyLabel(s.key).slice(0, 8),
                  value: s.totalPnl,
                  color: s.totalPnl >= 0 ? '#34d399' : '#f87171',
                }))}
              />
            </ForgeChartBezel>
          </Panel>
          <Panel title="Win / Loss" dense>
            <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:justify-around">
              <ForgeDonut
                wins={perfData?.wins ?? 0}
                losses={perfData?.losses ?? 0}
                label="Closed trades"
              />
              <div className="space-y-3">
                <ForgeMeterBank
                  label="Bull signals"
                  active={signals.filter((s) => s.action === 'BUY').length}
                  color="#34d399"
                />
                <ForgeMeterBank
                  label="Bear signals"
                  active={signals.filter((s) => s.action !== 'BUY').length}
                  color="#f87171"
                />
              </div>
            </div>
          </Panel>
          <Panel title="Regime analytics" dense>
            <div className="grid grid-cols-2 gap-3">
              <div className="forge-lcd p-3">
                <p className="forge-lcd-label">Regime</p>
                <p className={cn(
                  'mt-1 font-mono text-lg font-bold',
                  regime === 'Bullish' && 'text-positive',
                  regime === 'Bearish' && 'text-negative',
                  regime !== 'Bullish' && regime !== 'Bearish' && 'text-ink',
                )}>
                  {regime}
                </p>
              </div>
              <div className="forge-lcd p-3">
                <p className="forge-lcd-label">Avg conf</p>
                <p className="mt-1 font-mono text-lg font-bold text-teal tabular-nums">{avgConfidence}%</p>
              </div>
              <div className="col-span-2 forge-inset rounded-lg p-2">
                <DataSparkline values={confidenceTrend} up={avgConfidence >= 50} width={200} height={36} />
                <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-widest text-ink-muted">Confidence trend</p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Row 1: Signal feed | Portfolio chart | AI confidence */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel
          title="AI Signal Feed"
          data-tour="signals"
          action={
            <Badge variant="success" pulse>
              Live
            </Badge>
          }
        >
          {signals.length === 0 ? (
            <EmptyState
              title="No signals yet"
              description="Start the bot to generate signals."
            />
          ) : (
            <ul className="divide-y divide-border">
              {signals.slice(0, 6).map((s) => {
                const spark = symbolSparklines[s.ticker.toUpperCase()] ?? [];
                const sparkUp = spark.length >= 2 ? spark[spark.length - 1]! >= spark[0]! : s.action === 'BUY';
                return (
                  <li
                    key={`${s.ticker}-${s.createdAt}`}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <DataSparkline values={spark} up={sparkUp} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{s.ticker}</span>
                        <span className={cn(
                          'text-xs font-semibold',
                          s.action === 'BUY' ? 'text-positive' : 'text-negative',
                        )}>
                          {s.action === 'BUY' ? '▲' : '▼'} {s.action}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary">
                        {s.strategy} · {Math.round(s.confidence)}%
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">{minsAgo(s.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {signals.length > 0 && (
            <p className="mt-3 text-xs text-ink-muted">Signals update live</p>
          )}
        </Panel>

        <Panel
          title="Portfolio Value"
          data-tour="portfolio"
          action={
            <SegmentedControl
              options={EQUITY_TABS}
              value={tab}
              onChange={setTab}
              size="sm"
            />
          }
        >
          <p className="font-mono text-3xl font-bold tabular-nums text-ink">
            {equity > 0 ? money(equity) : '--'}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">{portfolioLabel}</p>
          <p className={cn('mt-2 text-sm font-semibold tabular-nums', dayGain >= 0 ? 'text-positive' : 'text-negative')}>
            {dayGain >= 0 ? '▲' : '▼'} {Math.abs(dayGainPct).toFixed(2)}% (Today)
            <span className="ml-2 opacity-70">
              {dayGain >= 0 ? '+' : ''}{money(dayGain)}
            </span>
            {alpacaDayGain != null && (
              <span className="ml-1.5 text-xs font-normal text-ink-muted">via Alpaca</span>
            )}
          </p>
          <div className="mt-4 h-48">
            <ForgeChartBezel label={`Equity curve · ${tab}`}>
              <div className="h-44">
                <PortfolioChart data={equityCurve} labels={chartLabels} />
              </div>
            </ForgeChartBezel>
          </div>
        </Panel>

        <Panel
          title="AI Confidence"
          className={cn(
            'relative',
            !showAdvanced && 'group cursor-pointer',
          )}
          onClick={showAdvanced ? undefined : () => gate('advancedAnalytics', 'Advanced analytics require Pro or Unlimited')}
          role={showAdvanced ? undefined : 'button'}
          tabIndex={showAdvanced ? undefined : 0}
        >
          {!showAdvanced && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-bg/72 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="text-sm font-semibold text-accent">Upgrade to unlock</span>
            </div>
          )}
          <ForgeChartBezel label="Neural confidence arc">
            <div className="mx-auto h-40 w-40">
              <ConfidenceGauge value={avgConfidence} />
            </div>
          </ForgeChartBezel>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-ink-secondary">Signal Regime</span>
            <span className={cn(
              'font-semibold',
              regime === 'Bullish' && 'text-positive',
              regime === 'Bearish' && 'text-negative',
              regime !== 'Bullish' && regime !== 'Bearish' && 'text-ink',
            )}>
              {regime} {regime === 'Bullish' ? '↗' : regime === 'Bearish' ? '↘' : '→'}
            </span>
          </div>
          <div className="mt-3">
            <DataSparkline values={confidenceTrend} up={avgConfidence >= 50} width={120} height={28} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Win rate {perfData ? `${winRate}%` : '--'} · {signals.length} recent signal{signals.length === 1 ? '' : 's'}
          </p>
        </Panel>
      </div>

      {/* Row 2: Strategy breakdown | Recent activity */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Closed Trades by Strategy"
          action={
            <span className="text-xs text-ink-muted">{closedTrades.length} closed</span>
          }
        >
          {closedTradesLoading ? (
            <p className="text-sm text-ink-secondary">Loading closed trades…</p>
          ) : topStrategies.length === 0 ? (
            <EmptyState
              title="No closed trades yet"
              description="Performance by strategy will appear after your first exits."
            />
          ) : (
            <DataTable>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Strategy</th>
                  <th className="pb-3 pr-4 text-right font-medium">Trades</th>
                  <th className="pb-3 pr-4 text-right font-medium">Win%</th>
                  <th className="pb-3 text-right font-medium">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {topStrategies.map((s) => (
                  <tr key={s.key} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 text-sm font-medium text-ink">
                      {formatStrategyLabel(s.key)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-sm tabular-nums text-ink-secondary">
                      {s.trades}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-sm tabular-nums text-ink-secondary">
                      {Math.round(s.winRate * 100)}%
                    </td>
                    <td className={cn('py-3 text-right font-mono text-sm font-semibold tabular-nums', pnlClass(s.totalPnl))}>
                      {s.totalPnl >= 0 ? '+' : ''}{money(s.totalPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        <Panel title="Recent Activity">
          {closedTradesLoading && signalsLoading ? (
            <p className="text-sm text-ink-secondary">Loading activity…</p>
          ) : recentActivity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Start the bot to generate signals and trades."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentActivity.map((item) =>
                item.kind === 'trade' ? (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{item.symbol}</span>
                        <Badge variant={resultBadgeVariant(item.result)}>{item.result}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-secondary">
                        {formatStrategyLabel(item.strategy)}
                        <span className="text-ink-muted"> · {minsAgo(item.at)}</span>
                      </p>
                    </div>
                    <span className={cn('shrink-0 font-mono text-sm font-semibold tabular-nums', pnlClass(item.pnl))}>
                      {(item.pnl ?? 0) >= 0 ? '+' : ''}{money(item.pnl)}
                    </span>
                  </li>
                ) : (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{item.symbol}</span>
                        <span className={cn(
                          'text-xs font-semibold',
                          item.action === 'BUY' ? 'text-positive' : 'text-negative',
                        )}>
                          {item.action}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-secondary">
                        {formatStrategyLabel(item.strategy)}
                        <span className="text-ink-muted">
                          {' '}· {Math.round(item.confidence)}% · {minsAgo(item.at)}
                        </span>
                      </p>
                    </div>
                    <Badge variant="muted">Signal</Badge>
                  </li>
                ),
              )}
            </ul>
          )}
          <a
            href="/history"
            className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            Full trade history →
          </a>
        </Panel>
      </div>

      {/* Row 3: Positions | Heatmap | Performance */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={`Positions (${positionsLoading ? '…' : (openPositionCount ?? livePositions.length)})`}
        >
          {positionsLoading ? (
            <p className="text-sm text-ink-secondary">Loading positions…</p>
          ) : livePositions.length === 0 ? (
            <EmptyState
              title="No open positions"
              description={
                !brokerConnected
                  ? 'Connect Alpaca in Settings for broker-backed paper trading, or start the bot to open simulator trades.'
                  : 'Start the bot to open trades on your watchlist.'
              }
            />
          ) : (
            <DataTable>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th className="pb-3 pr-3 font-medium">Symbol</th>
                  <th className="pb-3 pr-3 font-medium">Side</th>
                  <th className="pb-3 pr-3 text-right font-medium">Value</th>
                  <th className="pb-3 pr-3 text-right font-medium">P&amp;L</th>
                  <th className="pb-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {livePositions.map((p) => {
                  const pnl = p.unrealizedPnl ?? 0;
                  const pnlPct = p.unrealizedPnlPct ?? 0;
                  return (
                    <tr key={p.tradeId ?? p.symbol} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-3 font-mono text-sm font-bold text-ink">{p.symbol}</td>
                      <td className={cn(
                        'py-3 pr-3 text-sm font-medium',
                        p.side === 'LONG' ? 'text-positive' : 'text-negative',
                      )}>
                        {p.side === 'LONG' ? 'Long' : 'Short'}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono text-sm tabular-nums text-ink-secondary">
                        {p.marketValue != null ? money(p.marketValue) : `${p.qty} @ ${money(p.avgEntryPrice)}`}
                      </td>
                      <td className={cn('py-3 pr-3 text-right font-mono text-sm font-semibold tabular-nums', pnlClass(pnl))}>
                        {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${money(pnl)}` : '--'}
                      </td>
                      <td className={cn('py-3 text-right font-mono text-sm font-semibold tabular-nums', pnlClass(pnlPct))}>
                        {pnlPct !== 0 ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
          <a
            href="/history"
            className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            View trade history →
          </a>
        </Panel>

        <Panel title="Market Heatmap">
          {heatmapData.length === 0 ? (
            <EmptyState
              title="No watchlist symbols"
              description="Add symbols to your Watchlist to see live market heatmap."
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {heatmapData.slice(0, 7).map((t) => (
                <HeatmapTile key={t.sym} sym={t.sym} pct={t.pct} large={t.large} />
              ))}
              {heatmapData.slice(7).map((t) => (
                <HeatmapTile key={t.sym} sym={t.sym} pct={t.pct} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Performance">
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-secondary">Today</dt>
              <dd className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass(perfToday))}>
                {perfData || alpacaDayGain != null ? `${perfToday >= 0 ? '+' : ''}${money(perfToday)}` : '--'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-secondary">This Week</dt>
              <dd className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass(perfData?.weeklyPnl))}>
                {perfData ? `${perfData.weeklyPnl >= 0 ? '+' : ''}${money(perfData.weeklyPnl)}` : '--'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-secondary">This Month</dt>
              <dd className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass(perfData?.monthlyPnl))}>
                {perfData ? `${perfData.monthlyPnl >= 0 ? '+' : ''}${money(perfData.monthlyPnl)}` : '--'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-secondary">All Time</dt>
              <dd className={cn('font-mono text-sm font-semibold tabular-nums', pnlClass(perfData?.totalPnl))}>
                {perfData ? `${perfData.totalPnl >= 0 ? '+' : ''}${money(perfData.totalPnl)}` : '--'}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <DataSparkline values={perfPnlSeries} up={(perfData?.totalPnl ?? 0) >= 0} width={120} height={28} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs text-ink-muted">Win Rate</p>
              <p className={cn('mt-1 font-mono text-lg font-semibold tabular-nums', winRate >= 50 ? 'text-positive' : 'text-negative')}>
                {perfData ? `${winRate}%` : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Total Trades</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">
                {perfData?.totalTrades ?? '--'}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Open</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">
                {openPositionCount ?? '…'}
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
