'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  Crown,
  Loader2,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { PlanTier } from '@autotrade/shared';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';

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
  const {
    plans,
    currentPlan,
    effectiveTier,
    useLaunchPrices,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    trialEligibleTier,
  } = entitlements;

  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl"
        aria-labelledby="upgrade-modal-title"
      >
        <div className="p-6 pb-0">
          <DialogHeader className="mb-0 pr-8">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted text-accent">
                <Sparkles size={16} strokeWidth={2} aria-hidden />
              </span>
              <DialogTitle id="upgrade-modal-title" className="text-xl">
                Choose Your Plan
              </DialogTitle>
            </div>
            <DialogDescription className="text-ink-secondary">
              {reason ?? 'Upgrade to unlock live trading, faster scans, and advanced analytics.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pt-4">
          {error && (
            <div
              className="flex items-start gap-3 rounded-lg border border-negative/30 bg-negative-muted px-4 py-3"
              role="alert"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-negative" aria-hidden />
              <div>
                <strong className="text-sm font-semibold text-ink">Could not start checkout</strong>
                <p className="mt-0.5 text-sm text-ink-secondary">{error}</p>
              </div>
            </div>
          )}

          {!billingEnabled && cancelStep === 0 && (
            <p className="text-sm text-ink-secondary">
              Paid plans are temporarily unavailable. You can keep using paper trading while billing
              is being set up.
            </p>
          )}

          {trialEligibleTier && cancelStep === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-muted px-4 py-2.5 text-sm text-ink-secondary">
              <Sparkles size={14} className="shrink-0 text-accent" aria-hidden />
              <span>
                Try{' '}
                <strong className="text-ink">
                  {trialEligibleTier.charAt(0).toUpperCase() + trialEligibleTier.slice(1)}
                </strong>{' '}
                free for 48 hours on your first upgrade
              </span>
            </div>
          )}

          {currentPlan && cancelAtPeriodEnd && currentPeriodEnd && cancelStep === 0 && (
            <p className="text-sm text-ink-secondary">
              Your {currentPlan} plan remains active until{' '}
              {new Date(currentPeriodEnd).toLocaleDateString()}.
            </p>
          )}

          {cancelStep > 0 && (
            <div
              className="flex items-start gap-3 rounded-lg border border-negative/30 bg-negative-muted px-4 py-3"
              role="alert"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-negative" aria-hidden />
              <div>
                {cancelStep === 1 ? (
                  <>
                    <strong className="text-sm font-semibold text-ink">
                      Cancel your subscription?
                    </strong>
                    <p className="mt-0.5 text-sm text-ink-secondary">
                      You will lose live trading, faster scans, and all paid features immediately —
                      not at period end.
                    </p>
                  </>
                ) : (
                  <>
                    <strong className="text-sm font-semibold text-ink">
                      Are you absolutely sure?
                    </strong>
                    <p className="mt-0.5 text-sm text-ink-secondary">
                      Your bot will stop live execution and revert to the free paper simulator only.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {cancelStep === 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const meta = PLAN_META[plan.id];
                const Icon = meta.icon;
                const isCurrent = currentPlan === plan.id && effectiveTier !== 'free';
                const showLaunch = useLaunchPrices && plan.displayPriceMonthly < plan.priceMonthly;
                const showTrial = trialEligibleTier === plan.id;
                const { subtitle, bullets } = displayFeatures(plan);
                const label = ctaLabel(plan, isCurrent, !!currentPlan, showTrial);

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      'relative flex flex-col transition-shadow',
                      meta.featured && 'ring-1 ring-accent/40',
                      isCurrent && 'ring-2 ring-accent',
                    )}
                    style={{
                      borderColor: isCurrent || meta.featured ? plan.colors.border : undefined,
                    }}
                  >
                    {meta.featured && (
                      <div className="absolute -top-px left-1/2 -translate-x-1/2">
                        <Badge variant="default" className="rounded-b-none rounded-t-md px-2.5 py-1">
                          <Sparkles size={10} className="mr-1" aria-hidden />
                          Best value
                        </Badge>
                      </div>
                    )}

                    <CardContent className="flex flex-1 flex-col p-5 pt-6">
                      <div className="mb-4 flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: plan.colors.accentDim, color: plan.colors.accent }}
                          aria-hidden
                        >
                          <Icon size={20} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold text-ink">{plan.name}</h3>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
                              ${plan.displayPriceMonthly}
                            </span>
                            <span className="text-sm text-ink-muted">/mo</span>
                            {showLaunch && (
                              <span className="text-xs text-ink-muted line-through">
                                ${plan.priceMonthly}/mo
                              </span>
                            )}
                          </div>
                          {showTrial && (
                            <Badge variant="pos" className="mt-2">
                              48-hr free trial
                            </Badge>
                          )}
                        </div>
                      </div>

                      {subtitle && (
                        <p className="mb-3 text-xs font-medium text-ink-secondary">{subtitle}</p>
                      )}

                      <ul className="mb-5 flex-1 space-y-2">
                        {bullets.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm text-ink-secondary">
                            <span
                              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: plan.colors.accentDim, color: plan.colors.accent }}
                              aria-hidden
                            >
                              <Check size={10} strokeWidth={3} />
                            </span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        type="button"
                        variant={meta.featured ? 'default' : 'outline'}
                        className="w-full"
                        disabled={loading || isCurrent || !billingEnabled}
                        onClick={() => void onSelectTier(plan.id)}
                      >
                        {loading ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                        ) : (
                          <>
                            <span>{label}</span>
                            {!isCurrent && <ArrowRight size={16} aria-hidden />}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          {cancelStep > 0 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => setCancelStep(0)}
              >
                Keep my plan
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={loading}
                onClick={() => void handleCancelConfirm()}
              >
                {cancelStep === 1 ? 'Yes, continue' : 'Cancel subscription now'}
              </Button>
            </>
          ) : (
            <>
              {onReactivate && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => void onReactivate()}
                >
                  Keep subscription
                </Button>
              )}
              {onCancel && !cancelAtPeriodEnd && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setCancelStep(1)}
                  className="ml-auto text-ink-muted hover:text-negative"
                >
                  Cancel subscription
                </Button>
              )}
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
