'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  RISK_LEVELS,
  TIMEFRAMES,
  ErrorCodes,
  getAllPresetOptions,
  ALL_SCAN_INTERVALS,
  MIN_SCAN_INTERVAL_SECONDS,
  MAX_SCAN_INTERVAL_SECONDS,
  DEFAULT_SCAN_INTERVAL_SECONDS,
  formatScanInterval,
  detectActivePreset,
  applyStrategyPreset,
  CUSTOM_PRESET_ID,
  scanIntervalTier,
  canUseScanInterval,
  minTierForScanInterval,
  TIER_COLORS,
  type PlanTier,
} from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';
import { cn } from '@/lib/utils';
import { getPresetTheme } from '@/src/lib/presetThemes';
import { AlpacaConnectPanel } from '@/src/components/alpaca/AlpacaConnectPanel';
import { FounderSettingsPanel } from '@/src/components/settings/FounderSettingsPanel';
import { useAuth } from '@clerk/nextjs';
import { useSubscription, useUpgradeGate } from '@/src/components/subscription/SubscriptionProvider';
import {
  PageShell,
  PageHeader,
  Panel,
  Badge,
  AlertBanner,
  SegmentedControl,
} from '@/src/components/layout/PageShell';
import { Button } from '@/src/components/ui/button';
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

type BrokerStatus = {
  connected: boolean;
  paperConnected?: boolean;
  liveConnected?: boolean;
  provider?: string;
  paper?: boolean;
};

const inputClassName =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{ stock: StrategyCatalogEntry[]; crypto: StrategyCatalogEntry[] } | null>(
    null,
  );

  useEffect(() => {
    fetch('/api/v1/strategies/catalog')
      .then((r) => r.json())
      .then((data: { stock: StrategyCatalogEntry[]; crypto: StrategyCatalogEntry[] }) => setCatalog(data))
      .catch(() => setCatalog(null));
  }, []);

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
    return (
      <PageShell>
        <PageHeader title="Settings" />
        <p className="text-sm text-ink-secondary">Loading…</p>
      </PageShell>
    );
  }

  if (settingsData === null) {
    return (
      <PageShell>
        <PageHeader title="Settings" />
        <p className="text-sm text-ink-secondary">
          Could not load bot settings. Refresh the page or sign out and back in.
        </p>
      </PageShell>
    );
  }

  if (!local) {
    return (
      <PageShell>
        <PageHeader title="Settings" />
        <p className="text-sm text-ink-secondary">Loading…</p>
      </PageShell>
    );
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

  const modeOptions = (['PAPER', 'LIVE', 'DISABLED'] as const).filter(
    (m) => !(entitlements?.requiresPaperSimulator && m === 'LIVE'),
  );

  return (
    <PageShell className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-bg/95 px-4 py-4 backdrop-blur-sm md:-mx-8 md:px-8">
        <PageHeader
          title="Settings"
          description="Configure execution mode, risk limits, and trading strategies."
          actions={
            <>
              {saved && (
                <Badge variant="success">Saved</Badge>
              )}
              <Button type="button" onClick={() => void save()}>
                Save changes
              </Button>
            </>
          }
        />
      </div>

      {error && (
        <AlertBanner variant="error" onDismiss={() => setError(null)}>
          {error}
        </AlertBanner>
      )}

      {/* Broker + founder — top priority */}
      <Panel className="p-0 [&_.panel]:rounded-none [&_.panel]:border-0 [&_.panel]:bg-transparent [&_.panel]:shadow-none">
        <AlpacaConnectPanel broker={broker} liveEntitled={sub.entitled} onError={setError} />
      </Panel>

      <Panel className="p-0 [&_.founder-settings-panel]:rounded-none [&_.founder-settings-panel]:border-0 [&_.founder-settings-panel]:bg-transparent [&_.founder-settings-panel]:shadow-none">
        <FounderSettingsPanel />
      </Panel>

      {/* 1. Execution mode */}
      <Panel title="Execution mode">
        <p className="mb-4 text-sm text-ink-secondary">
          {sub.entitled
            ? 'Paper and live trading available — switch modes anytime'
            : billingEnabled
              ? 'Paper trading only · subscribe for live trading'
              : 'Paper trading only'}
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Execution mode">
          {modeOptions.map((m) => {
            const needsPaid = m === 'LIVE';
            const needsLiveKeys = m === 'LIVE' && !broker?.liveConnected;
            const locked = (needsPaid && !sub.entitled) || needsLiveKeys;
            const active = local.mode === m;

            return (
              <button
                key={m}
                type="button"
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors motion-safe:duration-200',
                  active
                    ? 'border-accent bg-accent-muted text-accent shadow-sm'
                    : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink',
                  locked && 'opacity-60',
                )}
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
                {m}
                {locked && <Lock size={13} aria-hidden className="shrink-0 opacity-80" />}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 2. Scan interval */}
      <Panel title="Scan interval">
        <p className="mb-4 text-sm leading-relaxed text-ink-secondary">
          How often the bot scans your watchlist when running. Shorter intervals react faster but use more API
          quota.
        </p>
        <ScanIntervalSlider
          value={local.scanIntervalSeconds}
          effectiveTier={sub.effectiveTier}
          onChange={(v) => set('scanIntervalSeconds', v)}
          onLockedClick={(sec) => gate(minTierForScanInterval(sec), `Scan every ${sec}s requires a higher plan`)}
        />
      </Panel>

      {/* 3. Risk settings */}
      <Panel title="Risk settings">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Risk level">
            <SegmentedControl
              options={RISK_LEVELS}
              value={local.riskLevel}
              onChange={(v) => set('riskLevel', v as RiskLevel)}
            />
          </Field>
          <Num label="Max active trades" v={local.maxActiveTrades} on={(n) => set('maxActiveTrades', n)} />
          <Num label="Max trade size ($)" v={local.maxTradeSize} on={(n) => set('maxTradeSize', n)} />
          <Num
            label="Risk per trade (%)"
            v={local.riskPerTradePct}
            step={0.1}
            on={(n) => set('riskPerTradePct', n)}
          />
          <Num
            label="Default stop (%)"
            v={local.defaultStopPct}
            step={0.1}
            on={(n) => set('defaultStopPct', n)}
          />
          <Num
            label="Default take-profit (%)"
            v={local.defaultTakeProfitPct}
            step={0.1}
            on={(n) => set('defaultTakeProfitPct', n)}
          />
          <Num label="Max daily loss ($)" v={local.maxDailyLoss} on={(n) => set('maxDailyLoss', n)} />
          <Num label="Min confidence (%)" v={local.minConfidence} on={(n) => set('minConfidence', n)} />
          <Field label="Trading hours start">
            <input
              type="time"
              value={local.tradingHoursStart}
              onChange={(e) => set('tradingHoursStart', e.target.value)}
              className={inputClassName}
            />
          </Field>
          <Field label="Trading hours end">
            <input
              type="time"
              value={local.tradingHoursEnd}
              onChange={(e) => set('tradingHoursEnd', e.target.value)}
              className={inputClassName}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Timeframes analyzed">
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => {
            const active = local.timeframes.includes(tf);
            return (
              <button
                key={tf}
                type="button"
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors motion-safe:duration-200',
                  active
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-ink-secondary hover:border-border-strong hover:text-ink',
                )}
                onClick={() => set('timeframes', toggleArr(local.timeframes, tf))}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 4. Strategy presets */}
      <Panel title="Strategy preset" data-tour="strategies">
        <p className="mb-4 text-sm text-ink-secondary">
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
            if (patch.includeExperimental && !gate('experimental', 'Experimental strategies require Unlimited'))
              return;
            if (
              patch.cryptoStrategies.length > 0 &&
              !gate('crypto', 'Crypto strategies require Pro or Unlimited')
            )
              return;
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
      </Panel>

      {entitlements?.limits?.quantToolsAccess ? (
        <Panel title="Quant tools">
          <p className="mb-4 text-sm text-ink-secondary">
            External analysis apps included with Pro and above.
          </p>
          <ul className="space-y-2">
            {(entitlements.quantToolLinks ?? []).map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel
          title="Quant tools"
          action={<Lock size={14} className="text-ink-muted" aria-hidden />}
          className="cursor-pointer transition-colors hover:border-border-strong"
          onClick={() => gate('quantTools', 'Quant tool links require Pro or Unlimited')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === 'Enter' && gate('quantTools', 'Quant tool links require Pro or Unlimited')
          }
        >
          <p className="text-sm text-ink-secondary">
            Upgrade to Pro for portfolio, backtester, and options tools.
          </p>
        </Panel>
      )}

      {/* 5. Stock / crypto strategy checklists */}
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

      {/* Email digest */}
      <Panel title="Email">
        <p className="mb-4 text-sm leading-relaxed text-ink-secondary">
          Welcome emails send once when you create an account. Weekly digests arrive Monday mornings with
          Autotrade tips, feature spotlights, and optional trading stats.
        </p>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-accent"
            checked={userProfile?.weeklyDigestEnabled !== false}
            onChange={(e) => {
              const enabled = e.target.checked;
              void dataApi
                .patchUser({ weeklyDigestEnabled: enabled })
                .then(() =>
                  fetch('/api/email/preferences', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled }),
                  }),
                )
                .catch((err) => {
                  reportTrackedError(ErrorCodes.CONFIG, err, { route: '/settings', action: 'weeklyDigest' });
                  setError(formatUserError(err, 'Could not update email preferences'));
                });
            }}
          />
          <span className="text-sm text-ink">Send me the Autotrade weekly digest</span>
        </label>
      </Panel>
    </PageShell>
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
        <p className="mb-3 text-sm text-ink-secondary">
          {presetSwitchesRemaining} preset switch{presetSwitchesRemaining === 1 ? '' : 'es'} remaining this
          week
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => {
          const active = preset.id === activePresetId;
          const isCustom = preset.id === CUSTOM_PRESET_ID;
          const theme = getPresetTheme(preset.id);
          const Icon = theme.icon;

          return (
            <button
              key={preset.id}
              type="button"
              className={cn(
                'relative rounded-xl border p-4 text-left transition-all motion-safe:duration-200',
                'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                active && 'ring-2 ring-offset-2 ring-offset-bg',
              )}
              style={{
                borderColor: theme.border,
                backgroundColor: theme.accentDim,
                ...(active ? { boxShadow: `0 0 24px ${theme.glow}`, outline: `2px solid ${theme.accent}` } : {}),
              }}
              onClick={() => onSelect(preset.id)}
              disabled={isCustom && active}
              title={isCustom && active ? 'Your current mix is custom. Adjust strategies below' : undefined}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: theme.glow, color: theme.accent }}
                  aria-hidden
                >
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <span className="font-semibold text-ink">{preset.label}</span>
              </div>
              <p className="text-sm leading-relaxed text-ink-secondary">{preset.description}</p>
              {active && (
                <span className="absolute right-3 top-3">
                  <Badge variant="success">Active</Badge>
                </span>
              )}
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
    <Panel
      title={title}
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{enabledCount} enabled</span>
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            None
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-ink-secondary">{subtitle}</p>

      {showExperimentalToggle && (
        <label className="mb-4 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-accent"
            checked={includeExperimental}
            onChange={(e) => onToggleExperimental(e.target.checked)}
          />
          <span className="text-sm text-ink-secondary">
            Show experimental strategies (need extra data feeds)
          </span>
        </label>
      )}

      {catalog.length === 0 ? (
        <p className="text-sm text-ink-secondary">Loading strategies…</p>
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
    </Panel>
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
    <Panel title="Master filters">
      <p className="mb-4 text-sm text-ink-secondary">
        Optional safety overlays that can veto trades. Enabled filters run before entry strategies.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {overlays.map((s) => {
          const on = !disabled.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                'rounded-lg border p-3 text-left transition-colors motion-safe:duration-200',
                on
                  ? 'border-accent/50 bg-accent-muted'
                  : 'border-border bg-surface hover:border-border-strong',
              )}
              onClick={() => toggle(s.id)}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{s.displayName}</span>
                <Badge variant={on ? 'success' : 'muted'}>{on ? 'on' : 'off'}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink-secondary">{s.description}</p>
            </button>
          );
        })}
      </div>
    </Panel>
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
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const on = selected.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                'rounded-lg border p-3 text-left transition-colors motion-safe:duration-200',
                on
                  ? 'border-accent bg-accent-muted'
                  : 'border-border bg-surface hover:border-border-strong',
              )}
              onClick={() => onToggle(s.id)}
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-ink">{s.displayName}</span>
                {s.isExperimental && <Badge variant="warning">experimental</Badge>}
                {s.source === 'legacy' && <Badge variant="muted">legacy</Badge>}
              </div>
              <p className="text-sm leading-relaxed text-ink-secondary">{s.description}</p>
              {s.bestRegimes.length > 0 && (
                <p className="mt-2 text-xs text-ink-muted">
                  Best in: {s.bestRegimes.slice(0, 3).join(', ')}
                </p>
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
  const tier = scanIntervalTier(resolved);
  const accent = tier ? TIER_COLORS[tier].accent : TIER_COLORS.essential.accent;

  function handleSelect(sec: number) {
    if (!canUseScanInterval(effectiveTier, sec)) {
      onLockedClick(sec);
      return;
    }
    onChange(sec);
  }

  return (
    <div style={{ ['--scan-accent' as string]: accent }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-ink-secondary">Between scans</span>
        <strong className="font-mono text-base tabular-nums text-ink">{formatScanInterval(resolved)}</strong>
      </div>
      <input
        type="range"
        className="scan-slider"
        min={MIN_SCAN_INTERVAL_SECONDS}
        max={MAX_SCAN_INTERVAL_SECONDS}
        step={1}
        value={resolved}
        onChange={(e) => handleSelect(Number(e.target.value))}
        aria-label="Scan interval"
      />
      <div className="mt-3 flex flex-wrap gap-4" role="presentation">
        {(['essential', 'pro', 'unlimited'] as const).map((tierKey) => (
          <span
            key={tierKey}
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: TIER_COLORS[tierKey].accent }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: TIER_COLORS[tierKey].accent }}
            />
            {tierKey === 'essential' ? '35–44s' : tierKey === 'pro' ? '20–34s' : '1–19s'}
          </span>
        ))}
      </div>
      <div className="relative mt-4 flex h-10 items-end justify-between" role="presentation">
        {ALL_SCAN_INTERVALS.map((sec) => {
          const on = sec === resolved;
          const tickTier = scanIntervalTier(sec);
          const locked = !canUseScanInterval(effectiveTier, sec);
          const tickAccent = tickTier ? TIER_COLORS[tickTier].accent : undefined;
          return (
            <button
              key={sec}
              type="button"
              className={cn(
                'group flex min-w-0 flex-1 flex-col items-center gap-1 px-0',
                locked && 'opacity-50',
              )}
              onClick={() => handleSelect(sec)}
              aria-label={`${sec} seconds${locked ? ' (upgrade required)' : ''}`}
              aria-pressed={on}
            >
              <span
                className={cn(
                  'block h-2 w-0.5 rounded-full transition-all',
                  on ? 'h-4 w-1' : 'bg-border group-hover:bg-ink-muted',
                )}
                style={on && tickAccent ? { background: tickAccent } : undefined}
              />
              {(sec === 1 || sec === 19 || sec === 20 || sec === 34 || sec === 35 || sec === 44) && (
                <span className="text-[10px] tabular-nums text-ink-muted">{sec}</span>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Num({
  label,
  v,
  on,
  step,
}: {
  label: string;
  v: number;
  on: (n: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={v}
        step={step ?? 1}
        onChange={(e) => on(Number(e.target.value))}
        className={cn(inputClassName, 'font-mono tabular-nums')}
      />
    </Field>
  );
}
