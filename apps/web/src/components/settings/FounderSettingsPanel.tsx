'use client';

import { useState } from 'react';
import { useFounderSettings, dataApi } from '@/src/hooks/data';
import { TIER_COLORS, type EffectiveTier } from '@autotrade/shared';
import { FlaskConical, Loader2, Sparkles } from 'lucide-react';

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
    <section className="panel founder-settings-panel" aria-labelledby="founder-settings-title">
      <div className="founder-settings-header">
        <div className="founder-settings-badge" aria-hidden>
          <FlaskConical size={16} strokeWidth={2} />
        </div>
        <div>
          <h2 id="founder-settings-title">Founder tools</h2>
          <p className="muted founder-settings-subtitle">
            Simulate how the app behaves for each subscription tier. Changes apply instantly across the dashboard, bot, and billing gates.
          </p>
        </div>
      </div>

      <div className="founder-settings-status">
        <div className="founder-settings-status-item">
          <span className="muted">App sees you as</span>
          <strong className="founder-settings-tier-pill">{tierLabel(founder.effectiveTier)}</strong>
        </div>
        <div className="founder-settings-status-item">
          <span className="muted">Billing record</span>
          <span>{founder.billingTier ? tierLabel(founder.billingTier) : 'None'}</span>
        </div>
      </div>

      <div className="founder-plan-grid" role="radiogroup" aria-label="Simulated plan tier">
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
              className={`founder-plan-card ${isActive ? 'founder-plan-card--active' : ''}`}
              style={{
                ['--tier-accent' as string]: colors.accent,
                ['--tier-accent-dim' as string]: colors.accentDim,
                ['--tier-border' as string]: colors.border,
              }}
              disabled={isSaving}
              onClick={() => void select(option.id)}
            >
              <div className="founder-plan-card-top">
                <span className="founder-plan-card-label">{option.label}</span>
                {option.id === 'unlimited' && (
                  <Sparkles size={13} className="founder-plan-card-icon" aria-hidden />
                )}
              </div>
              <p className="founder-plan-card-desc">{option.description}</p>
              {isSaving ? (
                <Loader2 size={14} className="founder-plan-card-spinner" aria-hidden />
              ) : isActive ? (
                <span className="founder-plan-card-active">Active</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="founder-settings-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
