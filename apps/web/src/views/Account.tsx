'use client';

import { useUser } from '@clerk/nextjs';
import { Crown, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { tierDisplayColor, tierDisplayLabel, type PlanTier } from '@autotrade/shared';
import { useSubscription } from '@/src/components/subscription/SubscriptionProvider';

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

function statusToneClass(status: string, effectiveTier: 'free' | PlanTier, cancelAtPeriodEnd: boolean): string {
  if (effectiveTier === 'free' || status === 'NONE') return 'account-status-neutral';
  if (cancelAtPeriodEnd || status === 'PAST_DUE') return 'account-status-warn';
  if (status === 'CANCELED') return 'account-status-bad';
  return 'account-status-ok';
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
      <div className="page">
        <h1>Account</h1>
        <p className="muted">Loading your account…</p>
      </div>
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
    <div className="page">
      <header className="page-head">
        <h1>Account</h1>
      </header>

      {/* ── Subscription ─────────────────────────────────────────── */}
      <section
        className="panel account-sub-card"
        style={{ ['--account-accent' as string]: accent }}
      >
        <div className="account-sub-head">
          <div className="account-plan-id">
            <span className="account-plan-icon" aria-hidden>
              {effectiveTier === 'unlimited' ? <Crown size={20} /> : <Sparkles size={20} />}
            </span>
            <div>
              <h2 className="account-plan-name">{tierDisplayLabel(effectiveTier)}</h2>
              <p className="muted account-plan-sub">
                {isPaid && planMeta
                  ? `$${planMeta.displayPriceMonthly}/mo`
                  : 'Paper trading & core features'}
              </p>
            </div>
          </div>
          <span className={`account-status ${statusToneClass(subscriptionStatus, effectiveTier, cancelAtPeriodEnd)}`}>
            {statusLabel(subscriptionStatus, effectiveTier, cancelAtPeriodEnd)}
          </span>
        </div>

        <div className="account-meta-grid">
          <div className="account-meta">
            <span className="account-meta-label">Current plan</span>
            <span className="account-meta-value">{tierDisplayLabel(effectiveTier)}</span>
          </div>
          {isPaid && (
            <>
              <div className="account-meta">
                <span className="account-meta-label">Days remaining</span>
                <span className="account-meta-value">
                  {days != null ? `${days} day${days === 1 ? '' : 's'}` : '—'}
                </span>
              </div>
              <div className="account-meta">
                <span className="account-meta-label">{renewLabel}</span>
                <span className="account-meta-value">
                  {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : '—'}
                </span>
              </div>
            </>
          )}
        </div>

        {cancelAtPeriodEnd && currentPeriodEnd && (
          <p className="account-note muted">
            Your {tierDisplayLabel(effectiveTier)} plan stays active until{' '}
            {new Date(currentPeriodEnd).toLocaleDateString()}. Reactivate any time before then to keep your features.
          </p>
        )}

        {!billingEnabled && !isPaid && (
          <p className="account-note muted">
            Paid plans are being finalized. You can keep using paper trading in the meantime.
          </p>
        )}

        <div className="account-actions">
          {!isPaid && (
            <button
              type="button"
              className="btn-primary"
              disabled={!billingEnabled}
              onClick={() => openUpgradeModal('Upgrade to unlock live trading and faster scans')}
            >
              <Sparkles size={15} aria-hidden /> Upgrade plan
            </button>
          )}

          {isPaid && (
            <button
              type="button"
              className="btn-primary"
              disabled={!billingEnabled}
              onClick={() => openUpgradeModal('Change your plan')}
            >
              <RefreshCw size={15} aria-hidden /> Change plan
            </button>
          )}

          {isPaid && cancelAtPeriodEnd && (
            <button
              type="button"
              className="btn-ghost"
              disabled={isUpgrading || !billingEnabled}
              onClick={() => void reactivatePlan()}
            >
              {isUpgrading ? <Loader2 size={15} className="account-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
              Reactivate subscription
            </button>
          )}

          {isPaid && !cancelAtPeriodEnd && (
            <button
              type="button"
              className="btn-ghost account-cancel-link"
              disabled={!billingEnabled}
              onClick={() => openUpgradeModal('Manage your subscription')}
            >
              <XCircle size={15} aria-hidden /> Cancel subscription
            </button>
          )}
        </div>
      </section>

      {/* ── Profile ──────────────────────────────────────────────── */}
      <section className="panel">
        <h2>Profile</h2>
        <div className="account-meta-grid" style={{ marginTop: '0.75rem' }}>
          <div className="account-meta">
            <span className="account-meta-label">Email</span>
            <span className="account-meta-value">{email || '—'}</span>
          </div>
          <div className="account-meta">
            <span className="account-meta-label">Membership</span>
            <span className="account-meta-value" style={{ color: accent }}>
              {tierDisplayLabel(effectiveTier)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
