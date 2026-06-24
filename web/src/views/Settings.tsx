'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import { RISK_LEVELS, TIMEFRAMES, ErrorCodes } from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { AlpacaConnectPanel } from '@/src/components/alpaca/AlpacaConnectPanel';

type Mode = 'DISABLED' | 'PAPER' | 'LIVE';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface StrategyCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  source: string;
  category: 'stock' | 'crypto';
  isOverlay: boolean;
  isExperimental: boolean;
  bestRegimes: string[];
}

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
  stockStrategies: string[];
  cryptoStrategies: string[];
  includeExperimental: boolean;
}

type BrokerStatus = { connected: boolean; provider?: string; paper?: boolean };

export function Settings() {
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const settingsData = useQuery(convexApi.botSettings.get);
  const brokerData   = useQuery(convexApi.brokerCredential.status);
  const billingStatus = useQuery(convexApi.subscription.getBillingStatus);
  const paperTrial    = useQuery(convexApi.subscription.getPaperTrial);

  const updateSettings = useMutation(convexApi.botSettings.update);
  const setModeMut     = useMutation(convexApi.botSettings.setMode);

  const [local, setLocal] = useState<LocalSettings | null>(null);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{ stock: StrategyCatalogEntry[]; crypto: StrategyCatalogEntry[] } | null>(null);

  useEffect(() => {
    fetch('/api/v1/strategies/catalog')
      .then((r) => r.json())
      .then((data: { stock: StrategyCatalogEntry[]; crypto: StrategyCatalogEntry[] }) => setCatalog(data))
      .catch(() => setCatalog(null));
  }, []);

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
      stockStrategies: settingsData.stockStrategies ?? [],
      cryptoStrategies: settingsData.cryptoStrategies ?? [],
      includeExperimental: settingsData.includeExperimental ?? false,
    });
  }, [settingsData, local]);

  const broker: BrokerStatus | null = brokerData ?? null;
  const billingEnabled = billingStatus?.billingEnabled ?? false;
  const sub = {
    entitled: billingStatus?.liveEntitled ?? paperTrial?.entitled ?? false,
    canUsePaperTrading: paperTrial?.canUsePaperTrading ?? true,
    paperTradesUsed: paperTrial?.paperTradesUsed ?? 0,
    paperTradesLimit: 0,
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
    if (convexAuthLoading || !isAuthenticated) {
      setError('Connecting your session — try again in a moment.');
      return;
    }
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
        stockStrategies: local.stockStrategies,
        cryptoStrategies: local.cryptoStrategies,
        includeExperimental: local.includeExperimental,
      });
      setSaved(true);
    } catch (err) {
      reportTrackedError(ErrorCodes.CONFIG, err, { route: '/settings', action: 'save' });
      setError(formatUserError(err, 'Could not save'));
    }
  }

  async function setMode(mode: Mode) {
    if (convexAuthLoading || !isAuthenticated) {
      setError('Connecting your session — try again in a moment.');
      return;
    }
    if (mode === 'LIVE' && !sub.entitled) {
      setError(
        billingEnabled
          ? 'Live trading requires an active subscription.'
          : 'Live trading is not available yet.',
      );
      return;
    }
    if (mode === 'LIVE' && !broker?.connected) {
      setError('Connect an Alpaca account first before enabling live trading.');
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

      <AlpacaConnectPanel broker={broker} onError={setError} />

      <section className="panel">
        <h2>Execution mode</h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <span className="muted" style={{ fontSize: '0.85em' }}>
            {sub.entitled
              ? 'Live trading enabled'
              : billingEnabled
                ? 'Paper trading enabled · subscribe for live trading'
                : 'Paper trading enabled'}
          </span>
        </div>
        <div className="chips">
          {(['PAPER', 'LIVE', 'DISABLED'] as const).map((m) => {
            const needsPro = m === 'LIVE';
            const locked = needsPro && (!broker?.connected || !sub.entitled);
            return (
              <button
                key={m}
                className={`chip ${local.mode === m ? 'on' : ''} ${locked ? 'disabled' : ''}`}
                onClick={() => void setMode(m)}
                title={
                  m === 'LIVE' && !broker?.connected
                    ? 'Connect Alpaca first'
                    : m === 'LIVE' && !sub.entitled
                    ? billingEnabled
                      ? 'Requires an active subscription'
                      : 'Live trading is not available yet'
                    : undefined
                }
              >
                {m}{needsPro && !sub.entitled ? ' 🔒' : ''}
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

      <div data-tour="strategies">
      <StrategySection
        title="Stock & ETF strategies"
        subtitle="Used for shares and ETFs on your watchlist during US market hours."
        catalog={catalog?.stock ?? []}
        selected={local.stockStrategies}
        includeExperimental={local.includeExperimental}
        onToggleExperimental={(v) => set('includeExperimental', v)}
        onChange={(ids) => set('stockStrategies', ids)}
      />

      <StrategySection
        title="Crypto strategies"
        subtitle="Used for crypto pairs (e.g. BTC/USD) — runs 24/7."
        catalog={catalog?.crypto ?? []}
        selected={local.cryptoStrategies}
        includeExperimental={local.includeExperimental}
        onToggleExperimental={(v) => set('includeExperimental', v)}
        onChange={(ids) => set('cryptoStrategies', ids)}
        showExperimentalToggle={false}
      />
      </div>
    </div>
  );
}

function StrategySection({
  title,
  subtitle,
  catalog,
  selected,
  includeExperimental,
  onToggleExperimental,
  onChange,
  showExperimentalToggle = true,
}: {
  title: string;
  subtitle: string;
  catalog: StrategyCatalogEntry[];
  selected: string[];
  includeExperimental: boolean;
  onToggleExperimental: (v: boolean) => void;
  onChange: (ids: string[]) => void;
  showExperimentalToggle?: boolean;
}) {
  const selectable = catalog.filter((s) => !s.isOverlay);
  const visible = selectable.filter((s) => includeExperimental || !s.isExperimental);
  const overlays = catalog.filter((s) => s.isOverlay);

  const legacy = visible.filter((s) => s.source === 'legacy');
  const modern = visible.filter((s) => s.source !== 'legacy');

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  function selectAll() {
    onChange(visible.map((s) => s.id));
  }

  function clearAll() {
    onChange([]);
  }

  const enabledCount = selected.filter((id) => visible.some((s) => s.id === id)).length;

  return (
    <section className="panel">
      <div className="row gap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{title}</h2>
          <p className="muted" style={{ fontSize: '0.85em', margin: 0 }}>{subtitle}</p>
        </div>
        <div className="row gap" style={{ flexShrink: 0 }}>
          <span className="muted" style={{ fontSize: 12 }}>{enabledCount} enabled</span>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={selectAll}>All</button>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={clearAll}>None</button>
        </div>
      </div>

      {showExperimentalToggle && (
        <label className="row gap" style={{ cursor: 'pointer', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={includeExperimental}
            onChange={(e) => onToggleExperimental(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>Show experimental strategies (need extra data feeds)</span>
        </label>
      )}

      {catalog.length === 0 ? (
        <p className="muted">Loading strategies…</p>
      ) : (
        <>
          {modern.length > 0 && (
            <StrategyGroup label="Current strategies" items={modern} selected={selected} onToggle={toggle} />
          )}
          {legacy.length > 0 && (
            <StrategyGroup label="Legacy (original engine)" items={legacy} selected={selected} onToggle={toggle} />
          )}
          {overlays.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Always active — master filters that can veto trades:
              </p>
              <div className="strategy-grid">
                {overlays.map((s) => (
                  <div key={s.id} className="strategy-card strategy-card-overlay">
                    <div className="strategy-card-title">{s.displayName}</div>
                    <p className="strategy-card-desc">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StrategyGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: StrategyCatalogEntry[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <p className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </p>
      <div className="strategy-grid">
        {items.map((s) => {
          const on = selected.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`strategy-card ${on ? 'strategy-card-on' : ''}`}
              onClick={() => onToggle(s.id)}
            >
              <div className="strategy-card-head">
                <span className="strategy-card-title">{s.displayName}</span>
                {s.isExperimental && <span className="tag">experimental</span>}
                {s.source === 'legacy' && <span className="tag">legacy</span>}
              </div>
              <p className="strategy-card-desc">{s.description}</p>
              {s.bestRegimes.length > 0 && (
                <p className="strategy-card-meta">Best in: {s.bestRegimes.slice(0, 3).join(', ')}</p>
              )}
            </button>
          );
        })}
      </div>
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
