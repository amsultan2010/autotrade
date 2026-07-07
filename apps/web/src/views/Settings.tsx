'use client';
import { useEffect, useState } from 'react';
import { RISK_LEVELS, TIMEFRAMES, ErrorCodes, getAllPresetOptions, ALL_SCAN_INTERVALS, MIN_SCAN_INTERVAL_SECONDS, MAX_SCAN_INTERVAL_SECONDS, DEFAULT_SCAN_INTERVAL_SECONDS, formatScanInterval, detectActivePreset, applyStrategyPreset, CUSTOM_PRESET_ID, scanIntervalTier, canUseScanInterval, minTierForScanInterval, TIER_COLORS, type PlanTier } from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { getPresetTheme } from '@/src/lib/presetThemes';
import { AlpacaConnectPanel } from '@/src/components/alpaca/AlpacaConnectPanel';
import { FounderSettingsPanel } from '@/src/components/settings/FounderSettingsPanel';
import { useAuth } from '@clerk/nextjs';
import { useSubscription, useUpgradeGate } from '@/src/components/subscription/SubscriptionProvider';
import {
  useBillingStatus,
  useBotSettings,
  useBrokerStatus,
  usePaperTrial,
  useUserProfile,
  dataApi,
} from '@/src/hooks/data';

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
  disabledStrategies: string[];
  scanIntervalSeconds: number;
}

type BrokerStatus = { connected: boolean; paperConnected?: boolean; liveConnected?: boolean; provider?: string; paper?: boolean };

export function Settings() {
  const { isSignedIn: isAuthenticated, isLoaded: authLoaded } = useAuth();
  const convexAuthLoading = !authLoaded;
  const { data: settingsData, loading: settingsLoading } = useBotSettings();
  const { data: userProfile } = useUserProfile();
  const { data: brokerData } = useBrokerStatus();
  const { data: billingStatus } = useBillingStatus();
  const { data: paperTrial } = usePaperTrial();
  const { entitlements } = useSubscription();
  const gate = useUpgradeGate();

  
  
  
  

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
      disabledStrategies: settingsData.disabledStrategies ?? [],
      scanIntervalSeconds: settingsData.scanIntervalSeconds ?? DEFAULT_SCAN_INTERVAL_SECONDS,
    });
  }, [settingsData, local]);

  const broker: BrokerStatus | null = brokerData ?? null;
  const billingEnabled = billingStatus?.billingEnabled ?? false;
  const sub = {
    entitled: entitlements?.liveEntitled ?? billingStatus?.liveEntitled ?? false,
    canUsePaperTrading: paperTrial?.canUsePaperTrading ?? true,
    paperTradesUsed: paperTrial?.paperTradesUsed ?? 0,
    paperTradesLimit: 0,
    effectiveTier: entitlements?.effectiveTier ?? 'free',
  };

  if (settingsLoading || settingsData === undefined) {
    return <div className="page"><h1>Settings</h1><p className="muted">Loading…</p></div>;
  }
  if (settingsData === null) {
    return (
      <div className="page">
        <h1>Settings</h1>
        <p className="muted">Could not load bot settings. Refresh the page or sign out and back in.</p>
      </div>
    );
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
      setError('Connecting your session. Try again in a moment.');
      return;
    }
    setError(null);
    try {
      await dataApi.updateBotSettings({
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
        disabledStrategies: local.disabledStrategies,
        scanIntervalSeconds: local.scanIntervalSeconds,
      });
      setSaved(true);
    } catch (err) {
      reportTrackedError(ErrorCodes.CONFIG, err, { route: '/settings', action: 'save' });
      setError(formatUserError(err, 'Could not save'));
    }
  }

  async function setMode(mode: Mode) {
    if (convexAuthLoading || !isAuthenticated) {
      setError('Connecting your session. Try again in a moment.');
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
      await dataApi.setBotMode(mode);
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

      <FounderSettingsPanel />

      <AlpacaConnectPanel broker={broker} liveEntitled={sub.entitled} onError={setError} />

      <section className="panel">
        <h2>Email</h2>
        <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.9em', lineHeight: 1.55 }}>
          Welcome emails send once when you create an account. Weekly digests arrive Monday mornings with Autotrade tips, feature spotlights, and optional trading stats.
        </p>
        <label className="row gap" style={{ alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={userProfile?.weeklyDigestEnabled !== false}
            onChange={(e) => {
              const enabled = e.target.checked;
              void dataApi.patchUser({ weeklyDigestEnabled: enabled })
                .then(() => fetch('/api/email/preferences', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled }),
                }))
                .catch((err) => {
                  reportTrackedError(ErrorCodes.CONFIG, err, { route: '/settings', action: 'weeklyDigest' });
                  setError(formatUserError(err, 'Could not update email preferences'));
                });
            }}
          />
          <span>Send me the Autotrade weekly digest</span>
        </label>
      </section>

      <section className="panel">
        <h2>Execution mode</h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <span className="muted" style={{ fontSize: '0.85em' }}>
            {sub.entitled
              ? 'Paper and live trading available — switch modes anytime'
              : billingEnabled
                ? 'Paper trading only · subscribe for live trading'
                : 'Paper trading only'}
          </span>
        </div>
        <div className="chips">
          {(['PAPER', 'LIVE', 'DISABLED'] as const)
            .filter((m) => !(entitlements?.requiresPaperSimulator && m === 'LIVE'))
            .map((m) => {
            const needsPaid = m === 'LIVE';
            const needsLiveKeys = m === 'LIVE' && !broker?.liveConnected;
            const needsPaperKeys = false;
            const locked = (needsPaid && !sub.entitled) || needsLiveKeys || needsPaperKeys;
            return (
              <button
                key={m}
                className={`chip ${local.mode === m ? 'on' : ''} ${locked ? 'disabled tier-locked' : ''}`}
                onClick={() => {
                  if (m === 'LIVE' && !gate('live', 'Live trading requires a paid plan')) return;
                  void setMode(m);
                }}
                title={
                  m === 'LIVE' && !broker?.liveConnected
                    ? 'Connect live Alpaca keys below first'
                    : m === 'LIVE' && !sub.entitled
                    ? billingEnabled
                      ? 'Requires an active subscription'
                      : 'Live trading is not available yet'
                    : undefined
                }
              >
                {m}{(needsPaid && !sub.entitled) || needsLiveKeys ? ' 🔒' : ''}
              </button>
            );
          })}
        </div>
      </section>


      <section className="panel">
        <h2>Scan interval</h2>
        <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.9em', lineHeight: 1.55 }}>
          How often the bot scans your watchlist when running. Shorter intervals react faster but use more API quota.
        </p>
        <ScanIntervalSlider
          value={local.scanIntervalSeconds}
          effectiveTier={sub.effectiveTier}
          onChange={(v) => set('scanIntervalSeconds', v)}
          onLockedClick={(sec) => gate(minTierForScanInterval(sec), `Scan every ${sec}s requires a higher plan`)}
        />
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

      <section className="panel" data-tour="strategies">
        <h2>Strategy preset</h2>
        <p className="muted" style={{ fontSize: '0.85em', marginTop: 0, marginBottom: '1rem' }}>
          Start from a preset or choose Custom to pick individual strategies below.
        </p>
        <StrategyPresetPicker
          activePresetId={detectActivePreset({
            stockStrategies: local.stockStrategies,
            cryptoStrategies: local.cryptoStrategies,
            includeExperimental: local.includeExperimental,
            riskLevel: local.riskLevel,
            minConfidence: local.minConfidence,
          })}
          onSelect={async (presetId) => {
            const patch = applyStrategyPreset(presetId);
            if (!patch || !local) return;
            const activeId = detectActivePreset({
              stockStrategies: local.stockStrategies,
              cryptoStrategies: local.cryptoStrategies,
              includeExperimental: local.includeExperimental,
              riskLevel: local.riskLevel,
              minConfidence: local.minConfidence,
            });
            if (activeId === presetId) return;
            if (patch.includeExperimental && !gate('experimental', 'Experimental strategies require Unlimited')) return;
            if (patch.cryptoStrategies.length > 0 && !gate('crypto', 'Crypto strategies require Pro or Unlimited')) return;
            try {
              await dataApi.switchPreset({
                presetId,
                stockStrategies: patch.stockStrategies,
                cryptoStrategies: patch.cryptoStrategies,
                includeExperimental: patch.includeExperimental,
                riskLevel: patch.riskLevel,
                minConfidence: patch.minConfidence,
              });
              setLocal((prev) =>
                prev
                  ? {
                      ...prev,
                      stockStrategies: patch.stockStrategies,
                      cryptoStrategies: patch.cryptoStrategies,
                      includeExperimental: patch.includeExperimental,
                      ...(patch.riskLevel !== undefined ? { riskLevel: patch.riskLevel } : {}),
                      ...(patch.minConfidence !== undefined ? { minConfidence: patch.minConfidence } : {}),
                    }
                  : prev,
              );
              setSaved(false);
            } catch (err) {
              setError(formatUserError(err, 'Could not switch preset'));
            }
          }}
          presetSwitchesRemaining={entitlements?.presetSwitchesRemaining ?? null}
        />
      </section>

      <div>
      {entitlements?.limits?.quantToolsAccess ? (
        <section className="panel tier-pro-accent">
          <h2>Quant tools</h2>
          <p className="muted" style={{ fontSize: '0.85em' }}>External analysis apps included with Pro and above.</p>
          <ul className="quant-tool-links">
            {(entitlements.quantToolLinks ?? []).map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="panel tier-locked-panel" onClick={() => gate('quantTools', 'Quant tool links require Pro or Unlimited')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && gate('quantTools', 'Quant tool links require Pro or Unlimited')}>
          <h2>Quant tools 🔒</h2>
          <p className="muted" style={{ fontSize: '0.85em' }}>Upgrade to Pro for portfolio, backtester, and options tools.</p>
        </section>
      )}

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
        subtitle="Used for crypto pairs (e.g. BTC/USD). Runs 24/7."
        catalog={catalog?.crypto ?? []}
        selected={local.cryptoStrategies}
        includeExperimental={local.includeExperimental}
        onToggleExperimental={(v) => set('includeExperimental', v)}
        onChange={(ids) => set('cryptoStrategies', ids)}
        showExperimentalToggle={false}
      />

      <MasterFiltersSection
        catalog={[...(catalog?.stock ?? []), ...(catalog?.crypto ?? [])]}
        disabled={local.disabledStrategies}
        onChange={(ids) => set('disabledStrategies', ids)}
      />

      </div>
    </div>
  );
}

function StrategyPresetPicker({
  activePresetId,
  onSelect,
  presetSwitchesRemaining,
}: {
  activePresetId: string;
  onSelect: (presetId: string) => void | Promise<void>;
  presetSwitchesRemaining: number | null;
}) {
  const presets = getAllPresetOptions();

  return (
    <>
      {presetSwitchesRemaining != null && (
        <p className="muted preset-switches-remaining" style={{ fontSize: '0.85em', marginBottom: '0.75rem' }}>
          {presetSwitchesRemaining} preset switch{presetSwitchesRemaining === 1 ? '' : 'es'} remaining this week
        </p>
      )}
    <div className="preset-grid">
      {presets.map((preset) => {
        const active = preset.id === activePresetId;
        const isCustom = preset.id === CUSTOM_PRESET_ID;
        const theme = getPresetTheme(preset.id);
        const Icon = theme.icon;

        return (
          <button
            key={preset.id}
            type="button"
            className={`preset-card ${active ? 'preset-card-on' : ''}`}
            style={{
              ['--preset-accent' as string]: theme.accent,
              ['--preset-accent-dim' as string]: theme.accentDim,
              ['--preset-border' as string]: theme.border,
              ['--preset-glow' as string]: theme.glow,
            }}
            onClick={() => onSelect(preset.id)}
            disabled={isCustom && active}
            title={isCustom && active ? 'Your current mix is custom. Adjust strategies below' : undefined}
          >
            <div className="preset-card-head">
              <span className="preset-card-icon" aria-hidden>
                <Icon size={18} strokeWidth={2.25} />
              </span>
              <div className="preset-card-title">{preset.label}</div>
            </div>
            <p className="preset-card-desc">{preset.description}</p>
            {active && <span className="preset-card-badge">Active</span>}
          </button>
        );
      })}
    </div>
    </>
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

        </>
      )}
    </section>
  );
}


function MasterFiltersSection({
  catalog,
  disabled,
  onChange,
}: {
  catalog: StrategyCatalogEntry[];
  disabled: string[];
  onChange: (disabledIds: string[]) => void;
}) {
  const overlays = Array.from(
    new Map(catalog.filter((s) => s.isOverlay).map((s) => [s.id, s])).values(),
  );
  if (overlays.length === 0) return null;

  function toggle(id: string) {
    onChange(disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id]);
  }

  return (
    <section className="panel" style={{ marginTop: '1rem' }}>
      <h2 style={{ marginBottom: 4 }}>Master filters</h2>
      <p className="muted" style={{ fontSize: '0.85em', margin: '0 0 1rem' }}>
        Optional safety overlays that can veto trades. Enabled filters run before entry strategies.
      </p>
      <div className="strategy-grid">
        {overlays.map((s) => {
          const on = !disabled.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`strategy-card strategy-card-overlay ${on ? 'strategy-card-on' : ''}`}
              onClick={() => toggle(s.id)}
            >
              <div className="strategy-card-head">
                <span className="strategy-card-title">{s.displayName}</span>
                <span className="tag">{on ? 'on' : 'off'}</span>
              </div>
              <p className="strategy-card-desc">{s.description}</p>
            </button>
          );
        })}
      </div>
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



function ScanIntervalSlider({
  value,
  effectiveTier,
  onChange,
  onLockedClick,
}: {
  value: number;
  effectiveTier: 'free' | PlanTier;
  onChange: (seconds: number) => void;
  onLockedClick: (seconds: number) => void;
}) {
  const resolved = ALL_SCAN_INTERVALS.includes(value) ? value : DEFAULT_SCAN_INTERVAL_SECONDS;
  const fillPct = ((resolved - MIN_SCAN_INTERVAL_SECONDS) / (MAX_SCAN_INTERVAL_SECONDS - MIN_SCAN_INTERVAL_SECONDS)) * 100;

  function handleSelect(sec: number) {
    if (!canUseScanInterval(effectiveTier, sec)) {
      onLockedClick(sec);
      return;
    }
    onChange(sec);
  }

  return (
    <div className="scan-interval-slider" style={{ ['--scan-fill-pct' as string]: `${fillPct}%` }}>
      <div className="row gap" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Between scans</span>
        <strong style={{ fontSize: 15 }}>{formatScanInterval(resolved)}</strong>
      </div>
      <input
        type="range"
        className="scan-interval-range"
        min={MIN_SCAN_INTERVAL_SECONDS}
        max={MAX_SCAN_INTERVAL_SECONDS}
        step={1}
        value={resolved}
        onChange={(e) => handleSelect(Number(e.target.value))}
        aria-label="Scan interval"
      />
      <div className="scan-interval-legend" role="presentation">
        {(['essential', 'pro', 'unlimited'] as const).map((tier) => (
          <span key={tier} className="scan-interval-legend-item" style={{ color: TIER_COLORS[tier].accent }}>
            <span className="scan-interval-legend-dot" style={{ background: TIER_COLORS[tier].accent }} />
            {tier === 'essential' ? '35–44s' : tier === 'pro' ? '20–34s' : '1–19s'}
          </span>
        ))}
      </div>
      <div className="scan-interval-ticks" role="presentation">
        {ALL_SCAN_INTERVALS.map((sec) => {
          const on = sec === resolved;
          const tier = scanIntervalTier(sec);
          const locked = !canUseScanInterval(effectiveTier, sec);
          const accent = tier ? TIER_COLORS[tier].accent : undefined;
          return (
            <button
              key={sec}
              type="button"
              className={`scan-interval-tick ${on ? 'scan-interval-tick-on' : ''} ${locked ? 'scan-interval-tick-locked' : ''}`}
              style={accent ? { ['--tick-accent' as string]: accent } : undefined}
              onClick={() => handleSelect(sec)}
              aria-label={`${sec} seconds${locked ? ' (upgrade required)' : ''}`}
              aria-pressed={on}
            >
              <span className="scan-interval-tick-mark" />
              {(sec === 1 || sec === 19 || sec === 20 || sec === 34 || sec === 35 || sec === 44) && (
                <span className="scan-interval-tick-label">{sec}</span>
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
