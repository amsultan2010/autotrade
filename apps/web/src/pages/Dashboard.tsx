'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PerformanceSummary } from '@autotrade/shared';
import { api } from '../api/client';
import { CountUp } from '../components/CountUp';
import { DataTicker } from '../components/DataTicker';

interface BotStatus {
  mode: string;
  running: boolean;
  openTrades: number;
  paperAccount: { balance: number; equity: number } | null;
}

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function Dashboard() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);
  const [signals, setSignals] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p, sig] = await Promise.all([api.botStatus(), api.getPerformance(), api.getSignals()]);
      setStatus(s);
      setPerf(p);
      setSignals(sig);
      setLoadErr(null);
    } catch {
      setLoadErr('Could not reach the server. Retrying…');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function toggle() {
    setBusy(true);
    try {
      if (status?.running) await api.botStop(); else await api.botStart();
      await load();
    } finally { setBusy(false); }
  }

  async function runNow() {
    setBusy(true);
    try { await api.botRunNow(); await load(); }
    finally { setBusy(false); }
  }

  const pnlClass = (n: number | null | undefined) => (n == null ? '' : n >= 0 ? 'pos' : 'neg');
  const pa = status?.paperAccount;
  const openPnl = pa ? pa.equity - pa.balance : null;

  return (
    <div className="page">
      <DataTicker />
      {loadErr && <div className="error-banner">{loadErr}</div>}

      <header className="page-head">
        <h1>Dashboard</h1>
        <div className="row gap">
          <span className={`badge ${status?.running ? 'badge-on' : 'badge-off'}`}>
            {status?.running && <span className="live-dot" />}
            {status ? (status.running ? 'BOT RUNNING · PAPER' : status.mode) : '…'}
          </span>
          <button className="btn-ghost" disabled={busy} onClick={() => void runNow()}>Scan now</button>
          <button className={status?.running ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={() => void toggle()}>
            {status?.running ? 'Stop bot' : 'Start bot'}
          </button>
        </div>
      </header>

      <div className="card-grid">
        <Stat label="Paper balance"         value={money(status?.paperAccount?.balance)} />
        <Stat label="Equity (live)"         value={money(status?.paperAccount?.equity)} />
        <Stat label="Open P/L (unrealized)" value={money(openPnl)}          cls={pnlClass(openPnl)} />
        <Stat label="Open trades"           value={String(status?.openTrades ?? '—')} />
        <Stat label="Realized P/L (closed)" value={money(perf?.totalPnl)}   cls={pnlClass(perf?.totalPnl)} />
        <Stat label="Win rate"              value={perf ? `${perf.winRate}%` : '—'} />
        <Stat label="Wins / Losses"         value={perf ? `${perf.wins} / ${perf.losses}` : '—'} />
        <Stat label="Max drawdown"          value={money(perf?.maxDrawdown)} cls="neg" />
        <Stat label="Best / Worst"          value={perf ? `${money(perf.bestTrade)} / ${money(perf.worstTrade)}` : '—'} />
      </div>

      <section className="panel">
        <h2>Recent decisions</h2>
        {signals.length === 0 ? (
          <p className="muted typewriter">
            No signals yet. Add symbols to your watchlist and start the bot — every decision appears here.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th><th>Ticker</th><th>Action</th>
                <th>Strategy</th><th>Conf.</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {signals.slice(0, 20).map((s, i) => (
                <tr key={`${String(s.createdAt)}-${String(s.ticker)}-${i}`}>
                  <td className="muted">{new Date(String(s.createdAt)).toLocaleTimeString()}</td>
                  <td className="mono">{String(s.ticker)}</td>
                  <td><span className={`pill pill-${String(s.action).toLowerCase()}`}>{String(s.action)}</span></td>
                  <td className="muted">{String(s.strategy)}</td>
                  <td>{Math.round(Number(s.confidence))}%</td>
                  <td className="muted truncate">{String(s.entryReason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="stat">
      <span className="hud-corners" aria-hidden="true" />
      <div className="stat-label">{label}</div>
      <CountUp value={value} cls={cls} />
    </div>
  );
}
