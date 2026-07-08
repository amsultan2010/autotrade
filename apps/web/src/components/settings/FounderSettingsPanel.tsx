'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useFounderSettings,
  useUserProfile,
  dataApi,
} from '@/src/hooks/data';
import { TIER_COLORS, type EffectiveTier } from '@autotrade/shared';
import {
  FlaskConical,
  Loader2,
  Sparkles,
  Search,
  Play,
  RotateCcw,
  Map,
  BookOpen,
  Zap,
  Users,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { ForgeLCD, ForgePlate } from '@/src/components/forge/ForgePrimitives';

type SimPlan = EffectiveTier | 'auto';

const PLAN_OPTIONS: Array<{ id: SimPlan; label: string; description: string }> = [
  { id: 'auto', label: 'Auto', description: 'Default founder access (Unlimited)' },
  { id: 'free', label: 'Free', description: 'Paper simulator only' },
  { id: 'essential', label: 'Essential', description: 'Live stocks, basic analytics' },
  { id: 'pro', label: 'Pro', description: 'Crypto, faster scans, advanced analytics' },
  { id: 'unlimited', label: 'Unlimited', description: 'All features unlocked' },
];

type LookupUser = {
  clerkId: string;
  email: string;
  role: string;
  status: string;
  alpacaGuideCompleted: boolean;
  productTourCompleted: boolean;
  weeklyDigestEnabled: boolean;
  founderPlanOverride: string | null;
  billingTier: string | null;
  subscriptionStatus: string | null;
  effectiveTier: string;
};

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FlaskConical;
  children: React.ReactNode;
}) {
  return (
    <ForgePlate className="overflow-hidden p-0" glow="teal">
      <div className="flex items-center gap-3 border-b border-border/80 bg-surface-raised/60 px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-muted text-teal shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
          <Icon size={17} strokeWidth={2} aria-hidden />
        </div>
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-teal md:text-base">
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </ForgePlate>
  );
}

export function FounderSettingsPanel() {
  const { data: founder, loading: founderLoading, refresh: refreshFounder } = useFounderSettings();
  const { refresh: refreshProfile } = useUserProfile();

  const [saving, setSaving] = useState<SimPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupUser | null>(null);

  if (founderLoading || founder === null || founder === undefined) return null;

  const active: SimPlan = (founder.planOverride as SimPlan | null | undefined) ?? 'auto';

  async function runAction(
    key: string,
    fn: () => Promise<void>,
    successMsg?: string,
  ) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await Promise.all([refreshFounder(), refreshProfile()]);
      if (successMsg) setMessage(successMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function select(plan: SimPlan) {
    if (plan === active) return;
    setSaving(plan);
    setError(null);
    try {
      await dataApi.setFounderPlanOverride(plan === 'auto' ? null : plan);
      await refreshFounder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update plan simulation');
    } finally {
      setSaving(null);
    }
  }

  async function lookupUser() {
    const email = searchEmail.trim();
    if (!email) return;
    setBusy('lookup');
    setError(null);
    setLookupResult(null);
    try {
      const res = await dataApi.founderAction({ action: 'lookupUser', email }) as { user: LookupUser | null };
      setLookupResult(res.user);
      if (!res.user) setError('No user found for that email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setBusy(null);
    }
  }

  async function patchLookup(patch: Record<string, boolean | string | null>) {
    if (!lookupResult) return;
    await runAction('patch-user', async () => {
      await dataApi.founderAction({
        action: 'patchUser',
        email: lookupResult.email,
        patch,
      });
      const res = await dataApi.founderAction({
        action: 'lookupUser',
        email: lookupResult.email,
      }) as { user: LookupUser | null };
      setLookupResult(res.user);
    }, 'User updated');
  }

  return (
    <section
      className="founder-settings-panel space-y-5"
      aria-labelledby="founder-settings-title"
    >
      <ForgePlate glow="teal" className="overflow-hidden p-0">
        <div className="border-b border-border/80 bg-surface-raised/50 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal/25 bg-teal-muted text-teal shadow-[var(--shadow-teal-glow)]"
                aria-hidden
              >
                <FlaskConical size={18} strokeWidth={2} />
              </div>
              <div>
                <h2
                  id="founder-settings-title"
                  className="font-display text-base font-bold uppercase tracking-[0.1em] text-ink md:text-lg"
                >
                  Founder console
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-secondary md:text-base">
                  Full internal toolkit for plan simulation, onboarding replay, user lookup, and feature
                  probes. Restricted to founder emails only.
                </p>
              </div>
            </div>
            <Badge variant="default" className="shrink-0">
              <Shield size={11} className="mr-1" aria-hidden />
              Founder access
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <ForgeLCD label="Effective tier" value={tierLabel(founder.effectiveTier)} />
          <ForgeLCD
            label="Billing record"
            value={founder.billingTier ? tierLabel(founder.billingTier) : 'None'}
            variant={founder.billingTier ? 'teal' : 'amber'}
          />
          <ForgeLCD
            label="Stripe"
            value={founder.billingEnabled ? 'ON' : 'OFF'}
            variant={founder.billingEnabled ? 'teal' : 'red'}
          />
          <ForgeLCD
            label="Launch prices"
            value={founder.useLaunchPrices ? 'YES' : 'NO'}
            variant="amber"
          />
        </div>
      </ForgePlate>

      {(error || message) && (
        <div
          className={cn(
            'forge-inset rounded-lg px-4 py-3 text-sm',
            error ? 'border-red/25 text-red' : 'border-teal/25 text-teal',
          )}
          role={error ? 'alert' : 'status'}
        >
          {error ?? message}
        </div>
      )}

      <Section title="Plan simulator" icon={Sparkles}>
        <p className="mb-4 text-sm leading-relaxed text-ink-secondary">
          Override how the app treats your subscription tier. Changes apply instantly across dashboard
          gates, bot limits, and upgrade modals.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Simulated plan tier">
          {PLAN_OPTIONS.map((option) => {
            const isActive = active === option.id;
            const tierKey = option.id === 'auto' ? 'unlimited' : option.id;
            const colors = TIER_COLORS[tierKey as keyof typeof TIER_COLORS] ?? TIER_COLORS.unlimited;
            const isSaving = saving === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={cn(
                  'forge-inset relative rounded-xl p-4 text-left transition-all',
                  'hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  isActive && 'ring-2',
                  isSaving && 'opacity-70',
                )}
                style={{
                  borderColor: isActive ? colors.border : undefined,
                  ['--tw-ring-color' as string]: isActive ? colors.accent : undefined,
                }}
                disabled={isSaving}
                onClick={() => void select(option.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-sm font-semibold md:text-base"
                    style={{ color: isActive ? colors.accent : undefined }}
                  >
                    {option.label}
                  </span>
                  {option.id === 'unlimited' && (
                    <Sparkles size={14} className={isActive ? 'text-accent' : 'text-ink-muted'} aria-hidden />
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{option.description}</p>
                <div className="mt-3 h-4">
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin text-ink-muted" aria-hidden />
                  ) : isActive ? (
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">Active</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Onboarding & tours" icon={BookOpen}>
        <p className="mb-4 text-sm text-ink-secondary">
          Replay first-run flows without creating a new account. After reset, refresh or navigate away
          and back — the modal/tour will appear automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void runAction('reset-onboarding', async () => {
                await dataApi.founderAction({ action: 'resetOnboarding' });
              }, 'Alpaca guide reset — reload to see it')
            }
          >
            {busy === 'reset-onboarding' ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            Replay Alpaca guide
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void runAction('reset-tour', async () => {
                await dataApi.founderAction({ action: 'resetTour' });
              }, 'Product tour reset')
            }
          >
            {busy === 'reset-tour' ? <Loader2 size={16} className="animate-spin" /> : <Map size={16} />}
            Replay product tour
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void runAction('reset-all', async () => {
                await dataApi.founderAction({ action: 'resetAllFlows' });
              }, 'All onboarding flows reset')
            }
          >
            {busy === 'reset-all' ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            Reset all flows
          </Button>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="forge-inset rounded-lg px-3 py-2">
            <dt className="text-ink-muted">Alpaca guide</dt>
            <dd className="font-semibold text-ink">{founder.alpacaGuideCompleted ? 'Completed' : 'Pending'}</dd>
          </div>
          <div className="forge-inset rounded-lg px-3 py-2">
            <dt className="text-ink-muted">Product tour</dt>
            <dd className="font-semibold text-ink">{founder.productTourCompleted ? 'Completed' : 'Pending'}</dd>
          </div>
        </dl>
      </Section>

      <Section title="User lookup" icon={Users}>
        <p className="mb-4 text-sm text-ink-secondary">
          Search any account by email. View tier, onboarding flags, and patch settings normal users
          cannot change.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              type="email"
              className="h-11 w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="user@example.com"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void lookupUser()}
            />
          </div>
          <Button type="button" onClick={() => void lookupUser()} disabled={busy === 'lookup'}>
            {busy === 'lookup' ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </Button>
        </div>

        {lookupResult && (
          <div className="mt-4 space-y-4 rounded-xl border border-border bg-surface-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{lookupResult.email}</p>
                <p className="text-sm text-ink-secondary">
                  {lookupResult.role} · {lookupResult.status} · sees as{' '}
                  <span className="text-teal">{tierLabel(lookupResult.effectiveTier)}</span>
                </p>
              </div>
              <Badge variant="muted">{lookupResult.subscriptionStatus ?? 'no sub'}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchLookup({
                    alpacaGuideCompleted: false,
                    productTourCompleted: false,
                  })
                }
              >
                Reset onboarding
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void patchLookup({ weeklyDigestEnabled: !lookupResult.weeklyDigestEnabled })}
              >
                Digest: {lookupResult.weeklyDigestEnabled ? 'ON' : 'OFF'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void patchLookup({ founderPlanOverride: 'free' })}
              >
                Force free tier
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void patchLookup({ founderPlanOverride: null })}
              >
                Clear plan override
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Feature probes" icon={Zap}>
        <p className="mb-4 text-sm text-ink-secondary">
          Trigger backend paths and jump to internal views for manual QA.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void runAction('scan', async () => {
                await dataApi.runBotScan();
              }, 'Manual scan triggered')
            }
          >
            {busy === 'scan' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Run bot scan
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void runAction('sync', async () => {
                await dataApi.syncBroker();
              }, 'Broker sync requested')
            }
          >
            {busy === 'sync' ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Sync broker
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin">Open admin console</Link>
          </Button>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Your founder access
          </p>
          <ul className="flex flex-wrap gap-2">
            {founder.allowedFounderEmails.map((email) => (
              <li key={email}>
                <span className="forge-inset inline-block rounded-md px-2.5 py-1 font-mono text-xs text-ink-secondary">
                  {email}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">
            Allowlist is configured via the FOUNDER_EMAILS environment variable (not exposed in the UI).
          </p>
        </div>
      </Section>
    </section>
  );
}
