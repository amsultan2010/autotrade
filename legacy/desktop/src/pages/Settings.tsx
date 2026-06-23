import { useEffect, useState } from 'react';
import { RISK_LEVELS, STRATEGIES, TIMEFRAMES, type BotSettingsDTO } from '@autotrade/shared';
import { api, ApiError } from '../api/client';

type BrokerStatus = { connected: boolean; provider?: string; paper?: boolean };

export function Settings() {
  const [s, setS] = useState<BotSettingsDTO | null>(null);
  const [broker, setBroker] = useState<BrokerStatus | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getSettings().then(setS).catch(() => setError('Could not load settings.')),
      api.brokerStatus().then(setBroker).catch(() => setBroker({ connected: false })),
    ]);
  }, []);

  if (!s && !error) return <div className="page"><h1>Settings</h1><p className="muted">Loading…</p></div>;
  if (!s) return <div className="page"><h1>Settings</h1><div className="error-banner">{error}</div></div>;

  function set<K extends keyof BotSettingsDTO>(key: K, value: BotSettingsDTO[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function save() {
    if (!s) return;
    setError(null);
    try {
      const updated = await api.updateSettings(s);
      setS(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  async function setMode(mode: BotSettingsDTO['mode']) {
    if (mode === 'LIVE' && !broker?.connected) {
      setError('Connect an Alpaca account first before enabling live trading.');
      return;
    }
    if (mode === 'LIVE' && broker?.paper) {
      setError('Your Alpaca account is set to paper trading. Connect with live trading enabled to use LIVE mode.');
      return;
    }
    setError(null);
    try {
      const updated = await api.updateSettings({ ...s!, mode });
      setS(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update mode');
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <div className="row gap">
          {saved && <span className="muted">Saved ✓</span>}
          <button className="btn-primary" onClick={() => void save()}>
            Save changes
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <AlpacaCard
        broker={broker}
        onError={setError}
        onStatusChange={(status) => setBroker(status)}
      />

      <section className="panel">
        <h2>Execution mode</h2>
        <p className="muted">
          Paper trading uses real market data with simulated money. Live trading executes real orders through your Alpaca account.
        </p>
        <div className="chips">
          {(['PAPER', 'LIVE', 'DISABLED'] as const).map((m) => {
            const locked = m === 'LIVE' && (!broker?.connected || broker?.paper);
            return (
              <button
                key={m}
                className={`chip ${s.mode === m ? 'on' : ''} ${locked ? 'disabled' : ''}`}
                onClick={() => void setMode(m)}
                title={
                  m === 'LIVE' && !broker?.connected
                    ? 'Connect a live Alpaca account first'
                    : m === 'LIVE' && broker?.paper
                    ? 'Switch Alpaca connection to live trading'
                    : undefined
                }
              >
                {m}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel form-grid">
        <Field label="Risk level">
          <select value={s.riskLevel} onChange={(e) => set('riskLevel', e.target.value as BotSettingsDTO['riskLevel'])}>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Num label="Max active trades" v={s.maxActiveTrades} on={(n) => set('maxActiveTrades', n)} />
        <Num label="Max trade size ($)" v={s.maxTradeSize} on={(n) => set('maxTradeSize', n)} />
        <Num label="Risk per trade (%)" v={s.riskPerTradePct} step={0.1} on={(n) => set('riskPerTradePct', n)} />
        <Num label="Default stop (%)" v={s.defaultStopPct} step={0.1} on={(n) => set('defaultStopPct', n)} />
        <Num label="Default take-profit (%)" v={s.defaultTakeProfitPct} step={0.1} on={(n) => set('defaultTakeProfitPct', n)} />
        <Num label="Max daily loss ($)" v={s.maxDailyLoss} on={(n) => set('maxDailyLoss', n)} />
        <Num label="Min confidence (%)" v={s.minConfidence} on={(n) => set('minConfidence', n)} />
        <Field label="Trading hours start">
          <input type="time" value={s.tradingHoursStart} onChange={(e) => set('tradingHoursStart', e.target.value)} />
        </Field>
        <Field label="Trading hours end">
          <input type="time" value={s.tradingHoursEnd} onChange={(e) => set('tradingHoursEnd', e.target.value)} />
        </Field>
      </section>

      <section className="panel">
        <h2>Timeframes analyzed</h2>
        <div className="chips">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`chip ${s.timeframes.includes(tf) ? 'on' : ''}`}
              onClick={() => set('timeframes', toggleArr(s.timeframes, tf))}
            >
              {tf}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Strategies</h2>
        <div className="chips">
          {STRATEGIES.map((st) => (
            <button
              key={st}
              className={`chip ${s.strategies.includes(st) ? 'on' : ''}`}
              onClick={() => set('strategies', toggleArr(s.strategies, st))}
            >
              {st}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AlpacaCard({
  broker,
  onError,
  onStatusChange,
}: {
  broker: BrokerStatus | null;
  onError: (msg: string) => void;
  onStatusChange: (status: BrokerStatus) => void;
}) {
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [paper, setPaper] = useState(true);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function connect() {
    if (!keyId || !secret) { onError('Enter both Key ID and Secret Key.'); return; }
    setLoading(true);
    onError('');
    try {
      const result = await api.brokerConnect(keyId, secret, paper);
      setKeyId('');
      setSecret('');
      onStatusChange(result);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not connect — check your keys and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setConfirming(false);
    setLoading(true);
    try {
      await api.brokerDisconnect();
      onStatusChange({ connected: false });
    } catch {
      onError('Could not disconnect. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (broker?.connected) {
    return (
      <section className="panel">
        <h2>Alpaca account</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Connected · {broker.paper ? 'Paper trading' : '⚡ Live trading'}
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
      {!paper && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          ⚠️ Live trading will execute real orders with real money. Make sure your Alpaca account is funded.
        </div>
      )}
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
