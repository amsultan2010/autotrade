'use client';

import { useUser } from '@clerk/nextjs';
import { Crown, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { tierDisplayColor, tierDisplayLabel, type PlanTier } from '@autotrade/shared';
import { useSubscription } from '@/src/components/subscription/SubscriptionProvider';
import {
  PageShell,
  PageHeader,
  StatCard,
  Panel,
  Badge,
  AlertBanner,
} from '@/src/components/layout/PageShell';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/src/components/ui/card';

function statusLabel(status: string, effectiveTier: 'free' | PlanTier, cancelAtPeriodEnd: boolean): string {
  if (effectiveTier === 'free') return 'Free plan';
  if (cancelAtPeriodEnd) return 'Cancels at period end';
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'TRIALING':
      return 'Free trial';
    case 'PAST_DUE':
      return 'Past due';
    case 'CANCELED':
      return 'Canceled';
    default:
      return 'Inactive';
  }
}

function statusBadgeVariant(
  status: string,
  effectiveTier: 'free' | PlanTier,
  cancelAtPeriodEnd: boolean,
): 'default' | 'success' | 'warning' | 'danger' | 'muted' {
  if (effectiveTier === 'free' || status === 'NONE') return 'muted';
  if (cancelAtPeriodEnd || status === 'PAST_DUE') return 'warning';
  if (status === 'CANCELED') return 'danger';
  return 'success';
}

function daysRemaining(periodEnd: number | null): number | null {
  if (!periodEnd) return null;
  const ms = periodEnd - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function Account() {
  const { user } = useUser();
  const {
    entitlements,
    openUpgradeModal,
    reactivatePlan,
    isUpgrading,
  } = useSubscription();

  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  if (!entitlements) {
    return (
      <PageShell>
        <PageHeader title="Account" />
        <p className="text-sm text-ink-secondary">Loading your account…</p>
      </PageShell>
    );
  }

  const {
    effectiveTier,
    currentPlan,
    subscriptionStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    billingEnabled,
    plans,
  } = entitlements;

  const isPaid = effectiveTier !== 'free';
  const accent = tierDisplayColor(effectiveTier);
  const planMeta = plans.find((p) => p.id === (currentPlan ?? effectiveTier));
  const days = daysRemaining(currentPeriodEnd);
  const renewLabel = cancelAtPeriodEnd ? 'Access ends' : 'Next billing date';

  return (
    <PageShell className="space-y-6">
      <PageHeader title="Account" />

      <Card
        className="overflow-hidden"
        style={{ borderColor: `color-mix(in oklab, ${accent} 35%, var(--color-border))` }}
      >
        <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface"
              style={{ color: accent }}
              aria-hidden
            >
              {effectiveTier === 'unlimited' ? <Crown size={20} /> : <Sparkles size={20} />}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                {tierDisplayLabel(effectiveTier)}
              </h2>
              <p className="mt-0.5 text-sm text-ink-secondary">
                {isPaid && planMeta
                  ? `$${planMeta.displayPriceMonthly}/mo`
                  : 'Paper trading & core features'}
              </p>
            </div>
          </div>
          <Badge variant={statusBadgeVariant(subscriptionStatus, effectiveTier, cancelAtPeriodEnd)}>
            {statusLabel(subscriptionStatus, effectiveTier, cancelAtPeriodEnd)}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-5 border-t border-border pt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Current plan" value={tierDisplayLabel(effectiveTier)} />
            {isPaid && (
              <>
                <StatCard
                  label="Days remaining"
                  value={days != null ? `${days} day${days === 1 ? '' : 's'}` : '—'}
                />
                <StatCard
                  label={renewLabel}
                  value={currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : '—'}
                />
              </>
            )}
          </div>

          {cancelAtPeriodEnd && currentPeriodEnd && (
            <AlertBanner variant="warning">
              Your {tierDisplayLabel(effectiveTier)} plan stays active until{' '}
              {new Date(currentPeriodEnd).toLocaleDateString()}. Reactivate any time before then to keep
              your features.
            </AlertBanner>
          )}

          {!billingEnabled && !isPaid && (
            <AlertBanner variant="info">
              Paid plans are being finalized. You can keep using paper trading in the meantime.
            </AlertBanner>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          {!isPaid && (
            <Button
              type="button"
              disabled={!billingEnabled}
              onClick={() => openUpgradeModal('Upgrade to unlock live trading and faster scans')}
            >
              <Sparkles size={15} aria-hidden />
              Upgrade plan
            </Button>
          )}

          {isPaid && (
            <Button
              type="button"
              disabled={!billingEnabled}
              onClick={() => openUpgradeModal('Change your plan')}
            >
              <RefreshCw size={15} aria-hidden />
              Change plan
            </Button>
          )}

          {isPaid && cancelAtPeriodEnd && (
            <Button
              type="button"
              variant="outline"
              disabled={isUpgrading || !billingEnabled}
              onClick={() => void reactivatePlan()}
            >
              {isUpgrading ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw size={15} aria-hidden />
              )}
              Reactivate subscription
            </Button>
          )}

          {isPaid && !cancelAtPeriodEnd && (
            <Button
              type="button"
              variant="ghost"
              className="text-ink-muted hover:text-negative"
              disabled={!billingEnabled}
              onClick={() => openUpgradeModal('Manage your subscription')}
            >
              <XCircle size={15} aria-hidden />
              Cancel subscription
            </Button>
          )}
        </CardFooter>
      </Card>

      <Panel title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Email</p>
            <p className="mt-1 text-sm text-ink">{email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Membership</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>
              {tierDisplayLabel(effectiveTier)}
            </p>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
