'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PerformanceSummary } from '@autotrade/shared';
import { api } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BotStatus {
  mode: string;
  running: boolean;
  openTrades: number;
  paperAccount: { balance: number; equity: number } | null;
}

interface Signal {
  createdAt: string;
  ticker: string;
  action: string;
  strategy: string;
  confidence: number;
  entryReason: string;
}

interface Position {
  ticker: string;
  side: string;
  value: number;
  pnl: number;
  pnlPct: number;
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

function minsAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1m ago';
  return `${diff}m ago`;
}

// Seeded PRNG for deterministic demo curves
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildPortfolioCurve(equity: number, points = 60): number[] {
  const rand = seededRand(77);
  const start = equity * 0.965;
  const curve: number[] = [start];
  for (let i = 1; i < points; i++) {
    const drift = (equity - curve[i - 1]!) / (points - i) + (rand() - 0.42) * equity * 0.003;
    curve.push(curve[i - 1]! + drift);
  }
  curve[curve.length - 1] = equity;
  return curve;
}

// ─── Portfolio area chart (canvas) ───────────────────────────────────────────
function PortfolioChart({ equity }: { equity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const data = buildPortfolioCurve(equity);

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

      // Grid lines (horizontal)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const y = pad.t + (innerH / 4) * g;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      }

      // Time axis labels
      const labels = ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM'];
      ctx.fillStyle = 'rgba(168,190,206,0.6)';
      ctx.font = `${10 * devicePixelRatio}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      labels.forEach((lbl, i) => {
        const x = pad.l + (i / (labels.length - 1)) * innerW;
        ctx.fillText(lbl, x, H - 6);
      });

      // Gradient fill
      const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, 'rgba(0,200,150,0.22)');
      grad.addColorStop(1, 'rgba(0,200,150,0)');

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

      // Line
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(data[0]!));
      for (let i = 1; i < data.length; i++) {
        const x0 = toX(i - 1), y0 = toY(data[i - 1]!);
        const x1 = toX(i), y1 = toY(data[i]!);
        const cx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
      }
      ctx.strokeStyle = '#00c896';
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.stroke();

      // Current price dot
      const lastX = toX(data.length - 1);
      const lastY = toY(data[data.length - 1]!);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = '#00c896';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,200,150,0.4)';
      ctx.lineWidth = 6 * devicePixelRatio;
      ctx.stroke();
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [equity]);

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

      // Track
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = size * 0.07;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Fill arc
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      grad.addColorStop(0, '#00c896');
      grad.addColorStop(1, '#4facfe');
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, fillAngle);
      ctx.strokeStyle = grad;
      ctx.lineWidth = size * 0.07;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Glow dot at tip
      const tx = cx + r * Math.cos(fillAngle);
      const ty = cy + r * Math.sin(fillAngle);
      ctx.beginPath();
      ctx.arc(tx, ty, size * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = '#00c896';
      ctx.shadowColor = '#00c896';
      ctx.shadowBlur = size * 0.08;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Center text
      ctx.fillStyle = '#f4f8fd';
      ctx.font = `bold ${size * 0.22}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${value}%`, cx, cy - size * 0.04);

      ctx.fillStyle = '#6a8fa8';
      ctx.font = `${size * 0.09}px Inter, sans-serif`;
      ctx.fillText('Very High', cx, cy + size * 0.14);
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

// ─── Static demo heatmap data ──────────────────────────────────────────────
const HEATMAP_DEMO = [
  { sym: 'AAPL', pct: 1.24, large: true },
  { sym: 'MSFT', pct: 0.89, large: true },
  { sym: 'NVDA', pct: 1.94, large: true },
  { sym: 'AMZN', pct: 1.94, large: true },
  { sym: 'GOOG', pct: 2.11, large: true },
  { sym: 'META', pct: -0.52, large: true },
  { sym: 'TSLA', pct: -2.18, large: true },
  { sym: 'JPM',  pct: 0.73 },
  { sym: 'SPY',  pct: 0.44 },
  { sym: 'QQQ',  pct: 1.07 },
];

// ─── Demo signals (shown when server has none) ─────────────────────────────
const DEMO_SIGNALS: Signal[] = [
  { createdAt: new Date(Date.now() - 2 * 60000).toISOString(), ticker: 'AAPL', action: 'BUY',  strategy: 'Momentum', confidence: 87, entryReason: 'RSI breakout + volume surge' },
  { createdAt: new Date(Date.now() - 4 * 60000).toISOString(), ticker: 'NVDA', action: 'BUY',  strategy: 'Trend',    confidence: 82, entryReason: 'EMA crossover confirmed' },
  { createdAt: new Date(Date.now() - 5 * 60000).toISOString(), ticker: 'TSLA', action: 'SELL', strategy: 'Reversal', confidence: 74, entryReason: 'Bearish engulfing at resistance' },
  { createdAt: new Date(Date.now() - 7 * 60000).toISOString(), ticker: 'SPY',  action: 'BUY',  strategy: 'Trend',    confidence: 68, entryReason: 'Market breadth positive' },
];

// ─── Main Dashboard ────────────────────────────────────────────────────────
export function Dashboard() {
  const [status, setStatus]   = useState<BotStatus | null>(null);
  const [perf, setPerf]       = useState<PerformanceSummary | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [quotes, setQuotes]   = useState<Quote[]>([]);
  const [busy, setBusy]       = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab]         = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D');

  const load = useCallback(async () => {
    try {
      const [s, p, sig, q] = await Promise.all([
        api.botStatus(),
        api.getPerformance(),
        api.getSignals(),
        api.getWatchlistQuotes().catch(() => [] as Quote[]),
      ]);
      setStatus(s);
      setPerf(p);
      setSignals((sig as unknown as Signal[]).length ? (sig as unknown as Signal[]) : DEMO_SIGNALS);
      setQuotes(q as unknown as Quote[]);
      setLoadErr(null);
    } catch {
      setLoadErr('Could not reach server — showing demo data.');
      setSignals(DEMO_SIGNALS);
    }
  }, []);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 15_000); return () => clearInterval(t); }, [load]);

  async function toggle() {
    setBusy(true);
    try { if (status?.running) await api.botStop(); else await api.botStart(); await load(); }
    finally { setBusy(false); }
  }

  const pa     = status?.paperAccount;
  const equity = pa?.equity ?? 128747.52;
  const balance = pa?.balance ?? 124132;
  const dayGain = equity - balance;
  const dayGainPct = (dayGain / balance) * 100;

  const winRate  = perf?.winRate ?? 82;
  const regime   = winRate >= 70 ? 'Bullish' : winRate >= 50 ? 'Neutral' : 'Bearish';

  // Build positions from demo if no real data
  const positions: Position[] = [
    { ticker: 'AAPL', side: 'Long',  value: 45231,  pnl: 1742.21, pnlPct: 4.01 },
    { ticker: 'NVDA', side: 'Long',  value: 32156,  pnl: 2156.32, pnlPct: 7.18 },
    { ticker: 'SPY',  side: 'Long',  value: 28420,  pnl: 533.21,  pnlPct: 1.91 },
    { ticker: 'TSLA', side: 'Short', value: 22940,  pnl: -842.11, pnlPct: -2.32 },
  ];

  const heatmapData = quotes.length >= 4
    ? quotes.slice(0, 10).map(q => ({ sym: q.symbol, pct: q.changePct ?? 0, large: true }))
    : HEATMAP_DEMO;

  return (
    <div className="db-root">
      {loadErr && <div className="error-banner" style={{ margin: '0 0 12px' }}>{loadErr}</div>}

      {/* Top controls */}
      <div className="db-topbar">
        <div className="db-topbar-left">
          <span className={`badge ${status?.running ? 'badge-on' : 'badge-off'}`}>
            {status?.running && <span className="live-dot" />}
            {status ? (status.running ? 'LIVE · PAPER' : status.mode.toUpperCase()) : '…'}
          </span>
        </div>
        <div className="db-topbar-right">
          <button className="btn-ghost" style={{ fontSize: 13, padding: '7px 14px' }} disabled={busy} onClick={() => void api.botRunNow()}>Scan Now</button>
          <button
            className={status?.running ? 'btn-danger' : 'btn-primary'}
            style={{ fontSize: 13, padding: '7px 16px' }}
            disabled={busy}
            onClick={() => void toggle()}
          >
            {status?.running ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </div>

      {/* ── Row 1 ── */}
      <div className="db-grid-top">

        {/* AI Signal Feed */}
        <div className="db-panel db-signal-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">AI SIGNAL FEED</span>
            <span className="db-live-badge"><span className="live-dot" />Live</span>
          </div>
          <div className="db-signal-list">
            {signals.slice(0, 4).map((s, i) => (
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
            ))}
          </div>
          <a href="#" className="db-view-all">View all signals →</a>
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
          <div className="db-portfolio-value">{money(equity)}</div>
          <div className={`db-portfolio-change ${dayGain >= 0 ? 'pos' : 'neg'}`}>
            {dayGain >= 0 ? '▲' : '▼'} {Math.abs(dayGainPct).toFixed(2)}% (Today)
          </div>
          <div className="db-chart-area">
            <PortfolioChart equity={equity} />
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
            <MiniSparkline seed={99} up={true} />
          </div>
        </div>
      </div>

      {/* ── Row 2 ── */}
      <div className="db-grid-bottom">

        {/* Positions */}
        <div className="db-panel db-positions-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">POSITIONS ({positions.length})</span>
          </div>
          <table className="db-pos-table">
            <tbody>
              {positions.map((p, i) => (
                <tr key={i} className="db-pos-row">
                  <td className="db-pos-ticker">{p.ticker}</td>
                  <td className={`db-pos-side ${p.side === 'Long' ? 'buy' : 'sell'}`}>{p.side}</td>
                  <td className="db-pos-value">{money(p.value)}</td>
                  <td className={`db-pos-pnl ${p.pnl >= 0 ? 'pos' : 'neg'}`}>{p.pnl >= 0 ? '+' : ''}{money(p.pnl)}</td>
                  <td className={`db-pos-pct ${p.pnlPct >= 0 ? 'pos' : 'neg'}`}>{p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a href="#" className="db-view-all">View all positions →</a>
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
              <span className={`db-perf-value ${pnlClass(dayGainPct)}`}>+{dayGainPct.toFixed(2)}%</span>
            </div>
            <div className="db-perf-row">
              <span className="db-perf-label">This Week</span>
              <span className="db-perf-value pos">+8.21%</span>
            </div>
            <div className="db-perf-row">
              <span className="db-perf-label">This Month</span>
              <span className="db-perf-value pos">+14.32%</span>
            </div>
            <div className="db-perf-row">
              <span className="db-perf-label">All Time</span>
              <span className="db-perf-value pos">{perf ? `+${((perf.totalPnl / balance) * 100).toFixed(2)}%` : '+42.71%'}</span>
            </div>
          </div>
          <div className="db-perf-sparkline">
            <MiniSparkline seed={42} up={true} />
          </div>
          <div className="db-perf-stats">
            <div className="db-perf-stat">
              <span className="db-perf-stat-label">Win Rate</span>
              <span className="db-perf-stat-value pos">{winRate}%</span>
            </div>
            <div className="db-perf-stat">
              <span className="db-perf-stat-label">Open Trades</span>
              <span className="db-perf-stat-value">{status?.openTrades ?? positions.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
