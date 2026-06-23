'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import { RISK_LEVELS, STRATEGIES, TIMEFRAMES, ErrorCodes } from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';

type Mode = 'DISABLED' | 'PAPER' | 'LIVE';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface LocalSettings {
  mode: Mode;
  riskLevel: RiskLevel;
  maxActiveTrades: number;
  maxTradeSize: number;
  riskPerTradePct: number;
  defaultStopPct: number;
  defaultTakeProfitPct: number;
  maxDailyLoss: number;
  tradingHoursStart: string;
  tradingHoursEnd: string;
  minConfidence: number;
  timeframes: string[];
  strategies: string[];
}

type BrokerStatus = { connected: boolean; provider?: string; paper?: boolean };

export function Settings() {
  const settingsData = useQuery(convexApi.botSettings.get);
  const brokerData   = useQuery(convexApi.brokerCredential.status);
  const subData      = useQuery(convexApi.subscription.get);
  const entitled     = useQuery(convexApi.subscription.isEntitled);
  const paperTrial   = useQuery(convexApi.subscription.getPaperTrial);

  const updateSettings = useMutation(convexApi.botSettings.update);
  const setModeMut     = useMutation(convexApi.botSettings.setMode);

  const [local, setLocal] = useState<LocalSettings | null>(null);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Populate local state from Convex once loaded.
  useEffect(() => {
    if (!settingsData || local) return;
    setLocal({
      mode: settingsData.mode,
      riskLevel: settingsData.riskLevel,
      maxActiveTrades: settingsData.maxActiveTrades,
      maxTradeSize: settingsData.maxTradeSize,
      riskPerTradePct: settingsData.riskPerTradePct,
      defaultStopPct: settingsData.defaultStopPct,
      defaultTakeProfitPct: settingsData.defaultTakeProfitPct,
      maxDailyLoss: settingsData.maxDailyLoss,
      tradingHoursStart: settingsData.tradingHoursStart,
      tradingHoursEnd: settingsData.tradingHoursEnd,
      minConfidence: settingsData.minConfidence,
      timeframes: settingsData.timeframes,
      strategies: settingsData.strategies,
    });
  }, [settingsData, local]);

  const broker: BrokerStatus | null = brokerData ?? null;
  const sub = {
    entitled: entitled ?? false,
    tier: subData?.tier ?? null,
    canUsePaperTrading: paperTrial?.canUsePaperTrading ?? true,
    paperTradesUsed: paperTrial?.paperTradesUsed ?? 0,
    paperTradesLimit: paperTrial?.paperTradesLimit ?? 10,
  };

  if (settingsData === undefined) {
    return <div className="page"><h1>Settings</h1><p className="muted">Loading…</p></div>;
  }
  // null = the user has no botSettings row yet. AuthProvider's ensureExists
  // seeds it on mount and Convex will push the update reactively, so this is a
  // brief, self-resolving state rather than an indefinite spinner.
  if (settingsData === null) {
    return <div className="page"><h1>Settings</h1><p className="muted">Setting up your account…</p></div>;
  }
  if (!local) {
    return <div className="page"><h1>Settings</h1><p className="muted">Loading…</p></div>;
  }

  function set<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
    setLocal((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function save() {
    if (!local) return;
    setError(null);
    try {
      await updateSettings({
        riskLevel: local.riskLevel,
        maxActiveTrades: local.maxActiveTrades,
        maxTradeSize: local.maxTradeSize,
        riskPerTradePct: local.riskPerTradePct,
        defaultStopPct: local.defaultStopPct,
        defaultTakeProfitPct: local.defaultTakeProfitPct,
        maxDailyLoss: local.maxDailyLoss,
        tradingHoursStart: local.tradingHoursStart,
        tradingHoursEnd: local.tradingHoursEnd,
        minConfidence: local.minConfidence,
        timeframes: local.timeframes,
        strategies: local.strategies,
      });
      setSaved(true);
    } catch (err) {
      reportTrackedError(ErrorCodes.CONFIG, err, { route: '/settings', action: 'save' });
      setError(formatUserError(err, 'Could not save'));
    }
  }

  async function setMode(mode: Mode) {
    if (mode === 'LIVE' && !sub.entitled) {
      setError('Live trading requires a Pro subscription. Upgrade to enable real money trading.');
      return;
    }
    if (mode === 'LIVE' && !broker?.connected) {
      setError('Connect an Alpaca account first before enabling live trading.');
      return;
    }
    if (mode === 'PAPER' && !sub.canUsePaperTrading) {
      setError(`Free paper trading limit reached (${sub.paperTradesLimit} trades). Upgrade to Pro to continue.`);
      return;
    }
    setError(null);
    try {
      await setModeMut({ mode });
      setLocal((prev) => (prev ? { ...prev, mode } : prev));
      setSaved(true);
    } catch (err) {
      reportTrackedError(ErrorCodes.BOT, err, { route: '/settings', action: 'setMode' });
      setError(formatUserError(err, 'Could not update mode'));
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <div className="row gap">
          {saved && <span className="muted">Saved ✓</span>}
          <button className="btn-primary" onClick={() => void save()}>Save changes</button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <AlpacaCard broker={broker} onError={setError} />

      <section className="panel">
        <h2>Execution mode</h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <span className={`chip ${sub.entitled ? 'on' : ''}`} style={{ marginRight: '0.5rem' }}>
            {sub.entitled ? `Pro${sub.tier ? ` · ${sub.tier}` : ''}` : 'Free'}
          </span>
          <span className="muted" style={{ fontSize: '0.85em' }}>
            {sub.entitled
              ? 'Live trading enabled · unlimited paper trading'
              : sub.canUsePaperTrading
                ? `Paper trial: ${sub.paperTradesUsed}/${sub.paperTradesLimit} trades used · upgrade to Pro for live trading`
                : `Paper trial used (${sub.paperTradesLimit}/${sub.paperTradesLimit} trades) · upgrade to Pro to continue`}
          </span>
        </div>
        <div className="chips">
          {(['PAPER', 'LIVE', 'DISABLED'] as const).map((m) => {
            const needsPro = m === 'LIVE';
            const paperLocked = m === 'PAPER' && !sub.canUsePaperTrading;
            const locked = (needsPro && (!broker?.connected || !sub.entitled)) || paperLocked;
            return (
              <button
                key={m}
                className={`chip ${local.mode === m ? 'on' : ''} ${locked ? 'disabled' : ''}`}
                onClick={() => void setMode(m)}
                title={
                  paperLocked
                    ? 'Free paper trading limit reached'
                    : m === 'LIVE' && !broker?.connected
                    ? 'Connect Alpaca first'
                    : m === 'LIVE' && !sub.entitled
                    ? 'Requires Pro subscription'
                    : undefined
                }
              >
                {m}{(needsPro && !sub.entitled) || paperLocked ? ' 🔒' : ''}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel form-grid">
        <Field label="Risk level">
          <select value={local.riskLevel} onChange={(e) => set('riskLevel', e.target.value as RiskLevel)}>
            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Num label="Max active trades" v={local.maxActiveTrades} on={(n) => set('maxActiveTrades', n)} />
        <Num label="Max trade size ($)" v={local.maxTradeSize} on={(n) => set('maxTradeSize', n)} />
        <Num label="Risk per trade (%)" v={local.riskPerTradePct} step={0.1} on={(n) => set('riskPerTradePct', n)} />
        <Num label="Default stop (%)" v={local.defaultStopPct} step={0.1} on={(n) => set('defaultStopPct', n)} />
        <Num label="Default take-profit (%)" v={local.defaultTakeProfitPct} step={0.1} on={(n) => set('defaultTakeProfitPct', n)} />
        <Num label="Max daily loss ($)" v={local.maxDailyLoss} on={(n) => set('maxDailyLoss', n)} />
        <Num label="Min confidence (%)" v={local.minConfidence} on={(n) => set('minConfidence', n)} />
        <Field label="Trading hours start">
          <input type="time" value={local.tradingHoursStart} onChange={(e) => set('tradingHoursStart', e.target.value)} />
        </Field>
        <Field label="Trading hours end">
          <input type="time" value={local.tradingHoursEnd} onChange={(e) => set('tradingHoursEnd', e.target.value)} />
        </Field>
      </section>

      <section className="panel">
        <h2>Timeframes analyzed</h2>
        <div className="chips">
          {TIMEFRAMES.map((tf) => (
            <button key={tf} className={`chip ${local.timeframes.includes(tf) ? 'on' : ''}`}
              onClick={() => set('timeframes', toggleArr(local.timeframes, tf))}>{tf}</button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Strategies</h2>
        <div className="chips">
          {STRATEGIES.map((st) => (
            <button key={st} className={`chip ${local.strategies.includes(st) ? 'on' : ''}`}
              onClick={() => set('strategies', toggleArr(local.strategies, st))}>{st}</button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AlpacaCard({
  broker,
  onError,
}: {
  broker: BrokerStatus | null;
  onError: (msg: string) => void;
}) {
  const connectBroker    = useAction(convexApi.brokerCredentialActions.connect);
  const disconnectBroker = useAction(convexApi.brokerCredentialActions.disconnect);

  const [keyId, setKeyId]         = useState('');
  const [secret, setSecret]       = useState('');
  const [paper, setPaper]         = useState(true);
  const [loading, setLoading]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function connect() {
    if (!keyId || !secret) { onError('Enter both Key ID and Secret Key.'); return; }
    setLoading(true);
    onError('');
    try {
      await connectBroker({ keyId, secret, paper });
      setKeyId('');
      setSecret('');
    } catch (err) {
      reportTrackedError(ErrorCodes.BROKER, err, { route: '/settings', action: 'connectBroker' });
      onError(formatUserError(err, 'Could not connect — check your keys and try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setConfirming(false);
    setLoading(true);
    try {
      await disconnectBroker({});
    } catch (err) {
      reportTrackedError(ErrorCodes.BROKER, err, { route: '/settings', action: 'disconnectBroker' });
      onError(formatUserError(err, 'Could not disconnect. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (broker?.connected) {
    return (
      <section className="panel">
        <h2>Alpaca account</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Connected · {broker.paper ? 'Paper trading' : 'Live trading'}
        </p>
        {confirming ? (
          <div className="row gap">
            <span className="muted">Remove your Alpaca connection?</span>
            <button className="btn-danger" onClick={() => void disconnect()} disabled={loading}>Yes, disconnect</button>
            <button className="btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirming(true)}>Disconnect</button>
        )}
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Connect Alpaca</h2>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Alpaca is a free brokerage that lets the AI execute trades for you.{' '}
        <a href="https://alpaca.markets" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          Create a free account →
        </a>
      </p>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <Field label="API Key ID">
          <input
            type="text"
            placeholder="PKxxxxxxxxxxxxxxxx"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Secret Key">
          <input
            type="password"
            placeholder="••••••••••••••••••••••••••••••••••••••••"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="row gap" style={{ marginBottom: '1rem' }}>
        <label className="row gap" style={{ cursor: 'pointer', gap: '0.5rem' }}>
          <input type="checkbox" checked={paper} onChange={(e) => setPaper(e.target.checked)} />
          <span>Paper trading (safe — no real money)</span>
        </label>
      </div>
      <button className="btn-primary" onClick={() => void connect()} disabled={loading || !keyId || !secret}>
        {loading ? 'Connecting…' : 'Connect Alpaca'}
      </button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Num({ label, v, on, step }: { label: string; v: number; on: (n: number) => void; step?: number }) {
  return (
    <Field label={label}>
      <input type="number" value={v} step={step ?? 1} onChange={(e) => on(Number(e.target.value))} />
    </Field>
  );
}
