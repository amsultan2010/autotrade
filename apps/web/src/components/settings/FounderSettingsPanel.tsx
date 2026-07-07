'use client';

import { useState } from 'react';
import { useFounderSettings, dataApi } from '@/src/hooks/data';
import { TIER_COLORS, type EffectiveTier } from '@autotrade/shared';
import { FlaskConical, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/src/components/ui/badge';

type SimPlan = EffectiveTier | 'auto';

const PLAN_OPTIONS: Array<{ id: SimPlan; label: string; description: string }> = [
  { id: 'auto', label: 'Auto', description: 'Default founder access (Unlimited)' },
  { id: 'free', label: 'Free', description: 'Paper simulator only' },
  { id: 'essential', label: 'Essential', description: 'Live stocks, basic analytics' },
  { id: 'pro', label: 'Pro', description: 'Crypto, faster scans, advanced analytics' },
  { id: 'unlimited', label: 'Unlimited', description: 'All features unlocked' },
];

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function FounderSettingsPanel() {
  const { data: founder, loading: founderLoading } = useFounderSettings();

  const [saving, setSaving] = useState<SimPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (founderLoading || founder === null || founder === undefined) return null;

  const active: SimPlan = (founder.planOverride as SimPlan | null | undefined) ?? 'auto';

  async function select(plan: SimPlan) {
    if (plan === active) return;
    setSaving(plan);
    setError(null);
    try {
      await dataApi.setFounderPlanOverride(plan === 'auto' ? null : plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update plan simulation');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section
      className="founder-settings-panel overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]"
      aria-labelledby="founder-settings-title"
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent"
            aria-hidden
          >
            <FlaskConical size={16} strokeWidth={2} />
          </div>
          <div>
            <h2 id="founder-settings-title" className="text-sm font-semibold uppercase tracking-wider text-ink-muted md:text-base">
              Founder tools
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-secondary md:text-base">
              Simulate how the app behaves for each subscription tier. Changes apply instantly across
              the dashboard, bot, and billing gates.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface-raised px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-muted">App sees you as</span>
            <Badge variant="default" className="w-fit text-xs">
              {tierLabel(founder.effectiveTier)}
            </Badge>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-muted">Billing record</span>
            <span className="text-sm font-semibold text-ink">
              {founder.billingTier ? tierLabel(founder.billingTier) : 'None'}
            </span>
          </div>
        </div>

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
                  'relative rounded-xl border bg-surface-raised p-4 text-left transition-all',
                  'hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  isActive ? 'ring-2' : 'border-border',
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
                    className="text-sm font-semibold"
                    style={{ color: isActive ? colors.accent : undefined }}
                  >
                    {option.label}
                  </span>
                  {option.id === 'unlimited' && (
                    <Sparkles
                      size={13}
                      className={isActive ? 'text-accent' : 'text-ink-muted'}
                      aria-hidden
                    />
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                  {option.description}
                </p>
                <div className="mt-3 h-4">
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin text-ink-muted" aria-hidden />
                  ) : isActive ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                      Active
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
