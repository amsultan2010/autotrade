'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react';
import { ErrorCodes } from '@autotrade/shared';
import { api as convexApi } from '@/convex/_generated/api';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { mergeOpenPositions, type DisplayPosition } from '@/lib/positions';
import {
  averageSignalConfidence,
  buildConfidenceTrend,
  buildCumulativePnlSeries,
  buildSimulatorEquityCurve,
  formatHistoryLabels,
  signalRegime,
  type EquityTab,
} from '@/lib/dashboard-charts';

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
    return <span className="muted" style={{ fontSize: 10, width, display: 'inline-block' }}>—</span>;
  }

  return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />;
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

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const botStatus     = useQuery(convexApi.botSettings.getStatus) as ConvexBotStatus | undefined;
  const perfData      = useQuery(convexApi.performance.summary) as ConvexPerf | undefined;
  const signalData    = useQuery(convexApi.signals.list, { limit: 10 }) as ConvexSignal[] | undefined;
  const watchlist     = useQuery(convexApi.watchlist.list) as Array<{ symbol: string }> | undefined;
  const tradeData     = useQuery(convexApi.trades.list, { limit: 200 }) as { items: Array<{ closedAt?: number; pnl?: number }> } | undefined;
  const openTrades    = useQuery(convexApi.trades.list, { result: 'OPEN', limit: 100 }) as {
    items: Array<{ _id: string; symbol: string; qty: number; entryPrice: number; side: string; brokerOrderId?: string }>;
  } | undefined;
  const brokerStatus  = useQuery(convexApi.brokerCredential.status);
  const brokerSnapshot = useQuery(convexApi.brokerSync.getSnapshot);
  const setMode       = useMutation(convexApi.botSettings.setMode);
  const runNow        = useAction(convexApi.bot.runNow);
  const syncBroker    = useAction(convexApi.brokerSyncActions.sync);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [tab, setTab]       = useState<EquityTab>('1D');
  const [alpacaEquitySeries, setAlpacaEquitySeries] = useState<number[] | null>(null);
  const [alpacaTimestamps, setAlpacaTimestamps] = useState<number[]>([]);
  const [symbolSparklines, setSymbolSparklines] = useState<Record<string, number[]>>({});

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

    return () => { cancelled = true; };
  }, [brokerConnected, convexAuthLoading, isAuthenticated, tab]);

  const signals: ConvexSignal[] = signalData ?? [];

  // Mini price sparklines for signal feed tickers (real 1D candles).
  const signalTickersKey = signals.slice(0, 4).map((s) => s.ticker).join(',');
  useEffect(() => {
    if (!signalTickersKey) return;
    const tickers = signalTickersKey.split(',').filter(Boolean);
    let cancelled = false;

    Promise.all(
      tickers.map(async (symbol) => {
        try {
          const r = await fetch(`/api/v1/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=1d&limit=14`);
          const json = (await r.json()) as { candles?: Array<{ c: number }> };
          const closes = (json.candles ?? []).map((c) => c.c);
          return [symbol.toUpperCase(), closes] as const;
        } catch {
          return [symbol.toUpperCase(), [] as number[]] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, number[]> = {};
      for (const [sym, closes] of entries) {
        if (closes.length >= 2) next[sym] = closes;
      }
      setSymbolSparklines(next);
    });

    return () => { cancelled = true; };
  }, [signalTickersKey]);

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
    setScanMessage(null);
    try {
      const result = (await runNow({})) as {
        ok?: boolean;
        reason?: string;
        symbolsScanned?: number;
        stockSymbols?: number;
        cryptoSymbols?: number;
        skippedMarketClosed?: number;
        signalsGenerated?: number;
        tradesOpened?: number;
      };

      if (result.reason === 'bot_stopped') {
        setScanMessage('Scan skipped — could not load bot settings.');
        return;
      }
      if (result.reason === 'empty_watchlist') {
        setScanMessage('Nothing to scan — add symbols to your Watchlist first.');
        return;
      }
      if (result.reason === 'market_data_unavailable') {
        setScanMessage('Could not load market data. Reconnect Alpaca in Settings.');
        return;
      }

      const scanned = result.symbolsScanned ?? 0;
      const signals = result.signalsGenerated ?? 0;
      const trades = result.tradesOpened ?? 0;
      const skipped = result.skippedMarketClosed ?? 0;
      const crypto = result.cryptoSymbols ?? 0;

      let msg = `Scanned ${scanned} symbol${scanned === 1 ? '' : 's'} · ${signals} signal${signals === 1 ? '' : 's'} · ${trades} trade${trades === 1 ? '' : 's'} opened`;
      if (skipped > 0) {
        msg += ` · ${skipped} stock${skipped === 1 ? '' : 's'} skipped (US market closed)`;
      }
      if (crypto > 0) {
        msg += ` · ${crypto} crypto (24/7)`;
      }
      if (signals === 0 && trades === 0 && scanned > 0) {
        msg += ' — no actionable BUY/SHORT yet (strategies may be HOLD or blocked by risk gates)';
      } else if (signals > 0 && trades === 0 && scanned > 0) {
        msg += ' — signals logged but no trade passed confidence/risk gates';
      }
      setScanMessage(msg);
    } catch (err) {
      reportTrackedError(ErrorCodes.BOT, err, { route: '/dashboard', action: 'scanNow' });
      setError(formatUserError(err, 'Scan failed — check that the bot is configured'));
    } finally {
      setBusy(false);
    }
  }

  // ── Account value ────────────────────────────────────────────────────────────
  const pa = botStatus?.paperAccount;
  const snap = brokerSnapshot;
  const hasAlpacaEquity = brokerConnected && snap != null && !snap.syncError;
  const equity = hasAlpacaEquity ? snap!.equity : (pa?.equity ?? 0);
  const balance = hasAlpacaEquity ? snap!.cash : (pa?.balance ?? equity);
  const simulatorOpenCount = (openTrades?.items ?? []).filter((t) => !t.brokerOrderId).length;
  const portfolioLabel = hasAlpacaEquity
    ? `Alpaca ${snap!.mode}`
    : brokerConnected
      ? 'Alpaca (syncing…)'
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
  const perfPnlSeries = buildCumulativePnlSeries(tradeData?.items ?? []);

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
      : buildSimulatorEquityCurve(equity, tradeData?.items ?? [], tab);
  const equityCurve = rawEquitySeries.length >= 2
    ? rawEquitySeries
    : buildSimulatorEquityCurve(Math.max(equity, 1), tradeData?.items ?? [], tab);
  const chartLabels =
    alpacaTimestamps.length >= 2
      ? formatHistoryLabels(alpacaTimestamps, tab)
      : formatHistoryLabels([], tab);

  const perfToday = alpacaDayGain ?? perfData?.dailyPnl ?? 0;

  // ── Positions: broker snapshot + simulator open trades (same source as history)
  const livePositions: DisplayPosition[] = mergeOpenPositions(snap?.positions ?? [], openTrades?.items ?? []);
  const openTradeCount = openTrades?.items.length ?? perfData?.openTrades ?? 0;
  const positionsLoading = brokerConnected && brokerSnapshot === undefined && openTrades === undefined;

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
          {brokerConnected && !snap && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Syncing Alpaca…</span>
          )}
        </div>
        <div className="db-topbar-right" data-tour="bot-controls">
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
          {/unauthorized|401|403/i.test(brokerError) && (
            <span>
              {' '}— Reconnect your paper API keys in Settings (generate new keys at app.alpaca.markets if needed).
            </span>
          )}
        </div>
      )}
      {dataLoading && (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Loading your account data…</p>
      )}
      {scanMessage && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(0,200,150,0.1)', borderColor: 'rgba(0,200,150,0.35)' }}>
          {scanMessage}
        </div>
      )}
      {!dataLoading && botStatus?.mode === 'DISABLED' && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(79,172,254,0.12)', borderColor: 'rgba(79,172,254,0.35)' }}>
          Bot is stopped. Tap <strong>Start Bot</strong> for automatic scans, or use <strong>Scan Now</strong> for a one-off run.
        </div>
      )}
      {!dataLoading && !brokerConnected && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(79,172,254,0.12)', borderColor: 'rgba(79,172,254,0.35)' }}>
          Portfolio shows the <strong>$100,000 simulator</strong>. Connect Alpaca in Settings to trade with your paper account balance.
        </div>
      )}
      {!dataLoading && brokerConnected && snap && !snap.syncError && livePositions.length === 0 && botStatus?.running && (
        <div className="error-banner" style={{ margin: '0 0 12px', background: 'rgba(79,172,254,0.12)', borderColor: 'rgba(79,172,254,0.35)' }}>
          Alpaca is connected — your keys work and we can read your paper account. No open positions yet: the bot only places orders when a strategy produces an approved <strong>BUY</strong> or <strong>SHORT</strong> (not HOLD). Tap <strong>Scan Now</strong> and read the green banner: look for how many <strong>trades opened</strong>.
        </div>
      )}
      {!dataLoading && brokerConnected && snap?.syncError && (
        <div className="error-banner" style={{ margin: '0 0 12px' }}>
          Alpaca sync failed: {snap.syncError}. Disconnect and reconnect your paper keys in Settings.
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
                No signals yet — start the bot to generate signals.
              </p>
            ) : (
              signals.slice(0, 4).map((s) => {
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
                    <span className="db-signal-conf">Confidence: {Math.round(s.confidence)}%</span>
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
        <DbPanel className="db-confidence-panel">
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
            Win rate {perfData ? `${winRate}%` : '—'} · {signals.length} recent signal{signals.length === 1 ? '' : 's'}
          </p>
        </DbPanel>
      </div>

      {/* ── Row 2 ── */}
      <div className="db-grid-bottom">

        {/* Positions */}
        <DbPanel className="db-positions-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">
              POSITIONS ({positionsLoading ? '…' : livePositions.length})
            </span>
          </div>
          {positionsLoading ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>Loading positions…</p>
          ) : livePositions.length === 0 ? (
            <p className="muted" style={{ padding: '1rem 0', fontSize: 13 }}>
              No open positions.
              {!brokerConnected
                ? ' Connect Alpaca in Settings for broker-backed paper trading, or start the bot to open simulator trades.'
                : ' Start the bot or tap Scan Now to open trades on your watchlist.'}
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
              <span className="db-perf-stat-value">{openTradeCount}</span>
            </div>
          </div>
        </DbPanel>
      </div>
    </div>
  );
}
