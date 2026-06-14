'use client';
import { useEffect, useState } from 'react';
import { RISK_LEVELS, STRATEGIES, TIMEFRAMES, type BotSettingsDTO } from '@autotrade/shared';
import { api, ApiError } from '../api/client';

export function Settings() {
  const [s, setS] = useState<BotSettingsDTO | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setS(await api.getSettings()); }
      catch { setError('Could not load settings. Check your connection and try again.'); }
    })();
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

      <section className="panel">
        <h2>Execution mode</h2>
        <p className="muted">
          Paper trading uses real market data. Live trading is disabled until a licensed broker is
          connected. This is a safety guard, not a limitation of your account.
        </p>
        <div className="chips">
          <span className={`chip ${s.mode === 'PAPER' ? 'on' : ''}`}>PAPER</span>
          <span className="chip disabled">LIVE (broker required)</span>
          <span className={`chip ${s.mode === 'DISABLED' ? 'on' : ''}`}>DISABLED</span>
        </div>
      </section>
    </div>
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
