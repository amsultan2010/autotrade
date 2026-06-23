'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react';
import { ErrorCodes } from '@autotrade/shared';
import { api as convexApi } from '@/convex/_generated/api';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';

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
}

// ─── API data shapes ──────────────────────────────────────────────────────────
interface BrokerPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  side: 'LONG' | 'SHORT';
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
}

interface Quote {
  symbol: string;
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
  const diff = Math.round((Date.now() - new Date(ts as string).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1m ago';
  return `${diff}m ago`;
}

// ─── Equity curve from real trade history ────────────────────────────────────
function buildRealCurve(
  startBalance: number,
  trades: Array<{ closedAt?: number; pnl?: number }>,
  tab: '1D' | '1W' | '1M' | '3M' | '1Y',
  points = 60,
): number[] {
  const now = Date.now();
  const tabMs: Record<typeof tab, number> = {
    '1D': 86_400_000,
    '1W': 7 * 86_400_000,
    '1M': 30 * 86_400_000,
    '3M': 90 * 86_400_000,
    '1Y': 365 * 86_400_000,
  };

  const closed = trades
    .filter((t) => t.closedAt != null && t.pnl != null && now - (t.closedAt ?? 0) <= tabMs[tab])
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));

  if (closed.length === 0) {
    // Flat line at current equity
    return Array(points).fill(startBalance) as number[];
  }

  // Build cumulative PnL series
  let running = startBalance;
  const points_data: number[] = [startBalance];
  for (const t of closed) {
    running += t.pnl ?? 0;
    points_data.push(running);
  }

  // Resample to exactly `points` data points
  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.round((i / (points - 1)) * (points_data.length - 1));
    result.push(points_data[Math.min(idx, points_data.length - 1)] ?? startBalance);
  }
  return result;
}

// Seeded PRNG for demo sparklines
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Portfolio area chart (canvas) ───────────────────────────────────────────
function PortfolioChart({ data }: { data: number[] }) {
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

      const labels = ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM'];
      ctx.fillStyle = 'rgba(168,190,206,0.6)';
      ctx.font = `${10 * devicePixelRatio}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      labels.forEach((lbl, i) => {
        const x = pad.l + (i / (labels.length - 1)) * innerW;
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
  }, [data]);

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

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function MiniSparkline({ seed, up }: { seed: number; up: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rand = seededRand(seed);
    const pts: number[] = [0.5];
    for (let i = 1; i < 14; i++) {
      pts.push(Math.max(0.05, Math.min(0.95, pts[i - 1]! + (rand() - (up ? 0.44 : 0.56)) * 0.18)));
    }

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
  }, [seed, up]);

  return <canvas ref={canvasRef} style={{ width: 44, height: 22, display: 'block' }} />;
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

// ─── Fallback heatmap when no watchlist quotes ─────────────────────────────────
const HEATMAP_FALLBACK = [
  { sym: 'AAPL', pct: 0, large: true },
  { sym: 'MSFT', pct: 0, large: true },
  { sym: 'NVDA', pct: 0, large: true },
  { sym: 'AMZN', pct: 0, large: true },
  { sym: 'GOOG', pct: 0, large: true },
  { sym: 'META', pct: 0, large: true },
  { sym: 'TSLA', pct: 0, large: true },
  { sym: 'JPM',  pct: 0 },
  { sym: 'SPY',  pct: 0 },
  { sym: 'QQQ',  pct: 0 },
];

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const botStatus     = useQuery(convexApi.botSettings.getStatus) as ConvexBotStatus | undefined;
  const perfData      = useQuery(convexApi.performance.summary) as ConvexPerf | undefined;
  const signalData    = useQuery(convexApi.signals.list, { limit: 10 }) as ConvexSignal[] | undefined;
  const watchlist     = useQuery(convexApi.watchlist.list) as Array<{ symbol: string }> | undefined;
  const tradeData     = useQuery(convexApi.trades.list, { limit: 200 }) as { items: Array<{ closedAt?: number; pnl?: number }> } | undefined;
  const brokerStatus  = useQuery(convexApi.brokerCredential.status);
  const brokerSnapshot = useQuery(convexApi.brokerSync.getSnapshot);
  const setMode       = useMutation(convexApi.botSettings.setMode);
  const runNow        = useAction(convexApi.bot.runNow);
  const syncBroker    = useAction(convexApi.brokerSyncActions.sync);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [tab, setTab]       = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D');

  // Fetch live prices for watchlist symbols
  const symbolsKey = watchlist?.map((w) => w.symbol).join(',') ?? '';
  useEffect(() => {
    if (!symbolsKey) return;
    const fetchPrices = () => {
      fetch(`/api/v1/watchlist/quotes?symbols=${encodeURIComponent(symbolsKey)}`)
        .then((r) => r.json())
        .then((data: Quote[]) => setQuotes(data))
        .catch(() => {});
    };
    fetchPrices();
    const t = setInterval(fetchPrices, 15_000);
    return () => clearInterval(t);
  }, [symbolsKey]);

  // Sync Alpaca account snapshot when broker is connected (reactive + periodic).
  const brokerConnected = brokerStatus?.connected === true;
  useEffect(() => {
    if (!brokerConnected || convexAuthLoading || !isAuthenticated) return;

    const runSync = () => {
      syncBroker({})
        .then((result) => {
          if (result.error) setBrokerError(result.error);
          else setBrokerError(null);
        })
        .catch((err) => {
          setBrokerError(formatUserError(err, 'Could not sync Alpaca account'));
        });
    };

    runSync();
    const t = setInterval(runSync, 15_000);
    return () => clearInterval(t);
  }, [brokerConnected, convexAuthLoading, isAuthenticated, syncBroker]);

  async function toggle() {
    if (convexAuthLoading || !isAuthenticated) {
      setError('Connecting your session — try again in a moment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextMode = botStatus?.running ? 'DISABLED' : 'PAPER';
      await setMode({ mode: nextMode });
    } catch (err) {
      reportTrackedError(ErrorCodes.BOT, err, { route: '/dashboard', action: 'toggle' });
      setError(formatUserError(err, 'Could not change bot mode'));
    } finally {
      setBusy(false);
    }
  }

  async function scanNow() {
    if (convexAuthLoading || !isAuthenticated) {
      setError('Connecting your session — try again in a moment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await runNow({});
    } catch (err) {
      reportTrackedError(ErrorCodes.BOT, err, { route: '/dashboard', action: 'scanNow' });
      setError(formatUserError(err, 'Scan failed — check that the bot is configured'));
    } finally {
      setBusy(false);
    }
  }

  // ── Account value ────────────────────────────────────────────────────────────
  // Priority: Alpaca snapshot → Convex paper account simulator
  const pa = botStatus?.paperAccount;
  const snap = brokerSnapshot;
  const equity = snap?.equity ?? pa?.equity ?? 0;
  const balance = snap?.cash ?? pa?.balance ?? equity;
  const alpacaDayGain = snap?.lastEquity != null ? snap.equity - snap.lastEquity : null;
  const dayGain = alpacaDayGain ?? perfData?.dailyPnl ?? 0;
  const dayGainPct = snap?.lastEquity != null && snap.lastEquity > 0
    ? (alpacaDayGain! / snap.lastEquity) * 100
    : balance > 0
      ? (dayGain / balance) * 100
      : 0;

  // ── Performance ──────────────────────────────────────────────────────────────
  const winRate = perfData ? Math.round(perfData.winRate * 100) : 0;
  const regime  = winRate >= 70 ? 'Bullish' : winRate >= 50 ? 'Neutral' : 'Bearish';

  // ── Signals ──────────────────────────────────────────────────────────────────
  const signals: ConvexSignal[] = signalData ?? [];

  // ── Heatmap from watchlist quotes ────────────────────────────────────────────
  const heatmapData = quotes.length >= 4
    ? quotes.slice(0, 10).map((q) => ({ sym: q.symbol, pct: q.changePct ?? 0, large: true }))
    : HEATMAP_FALLBACK;

  // ── Real positions (from Alpaca snapshot) or empty ───────────────────────────
  const livePositions: BrokerPosition[] = snap?.positions ?? [];
  const positionsLoading = brokerConnected && brokerSnapshot === undefined;

  // ── Real equity curve from trade history ─────────────────────────────────────
  const equityCurve = buildRealCurve(balance, tradeData?.items ?? [], tab);

  // ── Mode display ─────────────────────────────────────────────────────────────
  const modeLabel = botStatus
    ? botStatus.running
      ? `LIVE · ${botStatus.mode}`
      : botStatus.mode
    : convexAuthLoading
      ? 'Connecting…'
      : '…';

  const botControlsReady = !convexAuthLoading && isAuthenticated;
  const dataLoading = convexAuthLoading || (isAuthenticated && botStatus === undefined);

  return (
    <div className="db-root">
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
          {brokerConnected && !snap && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Syncing Alpaca…</span>
          )}
        </div>
        <div className="db-topbar-right">
          <button className="btn-ghost" style={{ fontSize: 13, padding: '7px 14px' }} disabled={busy || !botControlsReady} onClick={() => void scanNow()}>Scan Now</button>
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

      {error && (
        <div className="error-banner" style={{ margin: '0 0 12px' }}>{error}</div>
      )}
      {brokerError && (
        <div className="error-banner" style={{ margin: '0 0 12px' }}>
          Alpaca sync: {brokerError}
        </div>
      )}
      {dataLoading && (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Loading your account data…</p>
      )}

      {/* ── Row 1 ── */}
      <div className="db-grid-top">

        {/* AI Signal Feed */}
        <div className="db-panel db-signal-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">AI SIGNAL FEED</span>
            <span className="db-live-badge"><span className="live-dot" />Live</span>
          </div>
          <div className="db-signal-list">
            {signals.length === 0 ? (
              <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
                No signals yet — start the bot to generate signals.
              </p>
            ) : (
              signals.slice(0, 4).map((s, i) => (
                <div key={i} className="db-signal-row">
                  <MiniSparkline seed={i * 17 + 3} up={s.action === 'BUY'} />
                  <div className="db-signal-info">
                    <span className="db-signal-ticker">{s.ticker}</span>
                    <span className={`db-signal-action ${s.action === 'BUY' ? 'buy' : 'sell'}`}>
                      {s.action === 'BUY' ? '▲' : '▼'} {s.action}
                    </span>
                    <span className="db-signal-conf">Confidence: {Math.round(s.confidence)}%</span>
                  </div>
                  <span className="db-signal-age">{minsAgo(s.createdAt)}</span>
                </div>
              ))
            )}
          </div>
          {signals.length > 0 && <a href="#" className="db-view-all">View all signals →</a>}
        </div>

        {/* Portfolio Value */}
        <div className="db-panel db-portfolio-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">PORTFOLIO VALUE</span>
            <div className="db-tab-group">
              {(['1D','1W','1M','3M','1Y'] as const).map(t => (
                <button key={t} className={`db-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="db-portfolio-value">{equity > 0 ? money(equity) : '--'}</div>
          <div className={`db-portfolio-change ${dayGain >= 0 ? 'pos' : 'neg'}`}>
            {dayGain >= 0 ? '▲' : '▼'} {Math.abs(dayGainPct).toFixed(2)}% (Today)
            <span style={{ marginLeft: 8, opacity: 0.7 }}>{dayGain >= 0 ? '+' : ''}{money(dayGain)}</span>
            {alpacaDayGain != null && (
              <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>via Alpaca</span>
            )}
          </div>
          <div className="db-chart-area">
            <PortfolioChart data={equityCurve} />
          </div>
        </div>

        {/* AI Confidence */}
        <div className="db-panel db-confidence-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">AI CONFIDENCE</span>
          </div>
          <div className="db-gauge-wrap">
            <ConfidenceGauge value={winRate} />
          </div>
          <div className="db-regime-row">
            <span className="db-regime-label">Market Regime</span>
            <span className="db-regime-value teal">{regime} ↗</span>
          </div>
          <div className="db-confidence-chart">
            <MiniSparkline seed={99} up={winRate >= 50} />
          </div>
        </div>
      </div>

      {/* ── Row 2 ── */}
      <div className="db-grid-bottom">

        {/* Positions */}
        <div className="db-panel db-positions-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">
              POSITIONS ({positionsLoading ? '…' : livePositions.length})
            </span>
          </div>
          {positionsLoading ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>Loading positions…</p>
          ) : livePositions.length === 0 ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
              No open positions.{!brokerConnected && ' Connect Alpaca in Settings to see live positions.'}
            </p>
          ) : (
            <table className="db-pos-table">
              <tbody>
                {livePositions.map((p, i) => {
                  const pnl = p.unrealizedPnl ?? 0;
                  const pnlPct = p.unrealizedPnlPct ?? 0;
                  return (
                    <tr key={i} className="db-pos-row">
                      <td className="db-pos-ticker">{p.symbol}</td>
                      <td className={`db-pos-side ${p.side === 'LONG' ? 'buy' : 'sell'}`}>{p.side === 'LONG' ? 'Long' : 'Short'}</td>
                      <td className="db-pos-value">{p.marketValue != null ? money(p.marketValue) : `${p.qty} shares`}</td>
                      <td className={`db-pos-pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl >= 0 ? '+' : ''}{money(pnl)}</td>
                      <td className={`db-pos-pct ${pnlPct >= 0 ? 'pos' : 'neg'}`}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <a href="/history" className="db-view-all">View trade history →</a>
        </div>

        {/* Market Heatmap */}
        <div className="db-panel db-heatmap-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">MARKET HEATMAP</span>
          </div>
          <div className="db-heatmap-grid">
            {heatmapData.slice(0, 7).map((t, i) => (
              <HeatmapTile key={i} sym={t.sym} pct={t.pct} large={t.large} />
            ))}
            {heatmapData.slice(7).map((t, i) => (
              <HeatmapTile key={`s${i}`} sym={t.sym} pct={t.pct} />
            ))}
          </div>
        </div>

        {/* Performance */}
        <div className="db-panel db-perf-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">PERFORMANCE</span>
          </div>
          <div className="db-perf-list">
            <div className="db-perf-row">
              <span className="db-perf-label">Today</span>
              <span className={`db-perf-value ${pnlClass(dayGain)}`}>
                {perfData ? `${dayGain >= 0 ? '+' : ''}${money(dayGain)}` : '--'}
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
            <MiniSparkline seed={42} up={(perfData?.totalPnl ?? 0) >= 0} />
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
              <span className="db-perf-stat-value">
                {brokerConnected ? livePositions.length : (perfData?.openTrades ?? '--')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
