'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  Crown,
  Loader2,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { PlanTier } from '@autotrade/shared';

interface PlanCard {
  id: PlanTier;
  name: string;
  priceMonthly: number;
  displayPriceMonthly: number;
  features: string[];
  colors: { accent: string; accentDim: string; border: string };
}

interface EntitlementsShape {
  effectiveTier: 'free' | PlanTier;
  currentPlan: PlanTier | null;
  useLaunchPrices: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialEligibleTier?: PlanTier | null;
  plans: PlanCard[];
}

const PLAN_META: Record<
  PlanTier,
  { icon: LucideIcon; subtitle?: string; featured?: boolean }
> = {
  essential: {
    icon: BarChart3,
    subtitle: 'Live Alpaca trading for stocks',
  },
  pro: {
    icon: Zap,
    subtitle: 'Everything in Essential, plus',
  },
  unlimited: {
    icon: Crown,
    subtitle: 'Everything in Pro, plus',
    featured: true,
  },
};

function displayFeatures(plan: PlanCard): { subtitle: string | null; bullets: string[] } {
  const meta = PLAN_META[plan.id];
  const inherited = plan.features.find((f) => f.startsWith('Everything in'));
  const bullets = plan.features.filter((f) => !f.startsWith('Everything in'));
  return {
    subtitle: meta.subtitle ?? inherited ?? null,
    bullets,
  };
}

function ctaLabel(
  plan: PlanCard,
  isCurrent: boolean,
  hasPlan: boolean,
  showTrial: boolean,
): string {
  if (isCurrent) return 'Current plan';
  if (showTrial && !hasPlan) return 'Start free trial';
  if (hasPlan) return 'Switch plan';
  return 'Upgrade now';
}

export function UpgradeModal({
  entitlements,
  reason,
  onClose,
  onSelectTier,
  onCancel,
  onReactivate,
  loading,
  billingEnabled = true,
  error,
}: {
  entitlements: EntitlementsShape;
  reason?: string;
  onClose: () => void;
  onSelectTier: (tier: PlanTier) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onReactivate?: () => void | Promise<void>;
  loading?: boolean;
  billingEnabled?: boolean;
  error?: string | null;
}) {
  const { plans, currentPlan, effectiveTier, useLaunchPrices, cancelAtPeriodEnd, currentPeriodEnd, trialEligibleTier } =
    entitlements;

  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCancelConfirm() {
    if (!onCancel) return;
    if (cancelStep === 0) {
      setCancelStep(1);
      return;
    }
    if (cancelStep === 1) {
      setCancelStep(2);
      return;
    }
    await onCancel();
    setCancelStep(0);
  }

  return (
    <div
      className={`upgrade-modal-backdrop ${mounted ? 'upgrade-modal-backdrop--open' : ''}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`upgrade-modal ${mounted ? 'upgrade-modal--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upgrade-modal-ambient" aria-hidden />

        <header className="upgrade-modal-header">
          <div className="upgrade-modal-header-text">
            <div className="upgrade-modal-title-row">
              <span className="upgrade-modal-sparkle" aria-hidden>
                <Sparkles size={18} strokeWidth={2} />
              </span>
              <h2 id="upgrade-modal-title" className="upgrade-modal-title">
                Choose Your Plan
              </h2>
            </div>
            <p className="upgrade-modal-subtitle">
              {reason ?? 'Upgrade to unlock live trading, faster scans, and advanced analytics.'}
            </p>
          </div>
          <button type="button" className="upgrade-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {error && (
          <div className="upgrade-cancel-warning" role="alert">
            <AlertTriangle size={18} aria-hidden />
            <div>
              <strong>Could not start checkout</strong>
              <p className="muted">{error}</p>
            </div>
          </div>
        )}

        {!billingEnabled && cancelStep === 0 && (
          <p className="upgrade-modal-note muted">
            Paid plans are temporarily unavailable. You can keep using paper trading while billing is being set up.
          </p>
        )}

        {trialEligibleTier && cancelStep === 0 && (
          <div className="upgrade-modal-trial-banner">
            <Sparkles size={14} aria-hidden />
            <span>
              Try{' '}
              <strong>
                {trialEligibleTier.charAt(0).toUpperCase() + trialEligibleTier.slice(1)}
              </strong>{' '}
              free for 48 hours on your first upgrade
            </span>
          </div>
        )}

        {currentPlan && cancelAtPeriodEnd && currentPeriodEnd && cancelStep === 0 && (
          <p className="upgrade-modal-note muted">
            Your {currentPlan} plan remains active until{' '}
            {new Date(currentPeriodEnd).toLocaleDateString()}.
          </p>
        )}

        {cancelStep > 0 && (
          <div className="upgrade-cancel-warning" role="alert">
            <AlertTriangle size={18} aria-hidden />
            <div>
              {cancelStep === 1 ? (
                <>
                  <strong>Cancel your subscription?</strong>
                  <p className="muted">
                    You will lose live trading, faster scans, and all paid features immediately — not at period end.
                  </p>
                </>
              ) : (
                <>
                  <strong>Are you absolutely sure?</strong>
                  <p className="muted">
                    Your bot will stop live execution and revert to the free paper simulator only.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {cancelStep === 0 && (
          <div className="upgrade-plan-grid">
            {plans.map((plan, index) => {
              const meta = PLAN_META[plan.id];
              const Icon = meta.icon;
              const isCurrent = currentPlan === plan.id && effectiveTier !== 'free';
              const showLaunch = useLaunchPrices && plan.displayPriceMonthly < plan.priceMonthly;
              const showTrial = trialEligibleTier === plan.id;
              const { subtitle, bullets } = displayFeatures(plan);
              const label = ctaLabel(plan, isCurrent, !!currentPlan, showTrial);

              return (
                <article
                  key={plan.id}
                  className={[
                    'upgrade-plan-card',
                    `tier-${plan.id}`,
                    meta.featured ? 'upgrade-plan-card--featured' : '',
                    isCurrent ? 'upgrade-plan-card--current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    ['--tier-accent' as string]: plan.colors.accent,
                    ['--tier-accent-dim' as string]: plan.colors.accentDim,
                    ['--tier-border' as string]: plan.colors.border,
                    animationDelay: `${0.08 + index * 0.07}s`,
                  }}
                >
                  {meta.featured && (
                    <span className="upgrade-plan-ribbon">
                      <Sparkles size={11} aria-hidden />
                      Best value
                    </span>
                  )}

                  <div className="upgrade-plan-card-inner">
                    <div className="upgrade-plan-top">
                      <div className="upgrade-plan-icon-wrap" aria-hidden>
                        <Icon size={20} strokeWidth={2} />
                      </div>
                      <div className="upgrade-plan-head">
                        <h3>{plan.name}</h3>
                        <div className="upgrade-plan-price">
                          <span className="upgrade-plan-amount">${plan.displayPriceMonthly}</span>
                          <span className="upgrade-plan-period">/mo</span>
                          {showLaunch && (
                            <span className="upgrade-plan-was">${plan.priceMonthly}/mo</span>
                          )}
                        </div>
                        {showTrial && (
                          <span className="upgrade-plan-trial-pill">48-hr free trial</span>
                        )}
                      </div>
                    </div>

                    {subtitle && <p className="upgrade-plan-inherit">{subtitle}</p>}

                    <ul className="upgrade-plan-features">
                      {bullets.map((feature) => (
                        <li key={feature}>
                          <span className="upgrade-plan-check" aria-hidden>
                            <Check size={14} strokeWidth={2.5} />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`upgrade-plan-cta ${meta.featured ? 'upgrade-plan-cta--gold' : ''}`}
                      disabled={loading || isCurrent || !billingEnabled}
                      onClick={() => void onSelectTier(plan.id)}
                    >
                      {loading ? (
                        <Loader2 size={16} className="upgrade-plan-cta-spinner" aria-hidden />
                      ) : (
                        <>
                          <span>{label}</span>
                          {!isCurrent && <ArrowRight size={16} aria-hidden />}
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="upgrade-modal-footer">
          {cancelStep > 0 ? (
            <>
              <button type="button" className="btn-ghost" disabled={loading} onClick={() => setCancelStep(0)}>
                Keep my plan
              </button>
              <button type="button" className="btn-danger" disabled={loading} onClick={() => void handleCancelConfirm()}>
                {cancelStep === 1 ? 'Yes, continue' : 'Cancel subscription now'}
              </button>
            </>
          ) : (
            <>
              {onReactivate && (
                <button type="button" className="btn-ghost" disabled={loading} onClick={() => void onReactivate()}>
                  Keep subscription
                </button>
              )}
              {onCancel && !cancelAtPeriodEnd && (
                <button
                  type="button"
                  className="btn-ghost upgrade-cancel-link"
                  disabled={loading}
                  onClick={() => setCancelStep(1)}
                >
                  Cancel subscription
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
