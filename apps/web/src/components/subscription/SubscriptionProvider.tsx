'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePlanEntitlements } from '@/src/hooks/data';
import { UpgradeModal } from './UpgradeModal';
import type { PlanTier } from '@autotrade/shared';

interface PlanEntitlements {
  billingEnabled: boolean;
  useLaunchPrices: boolean;
  effectiveTier: 'free' | PlanTier;
  currentPlan: PlanTier | null;
  subscriptionStatus: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  liveEntitled: boolean;
  canUsePaperTrading: boolean;
  requiresPaperSimulator: boolean;
  trialEligibleTier: PlanTier | null;
  presetSwitchesRemaining: number | null;
  quantToolLinks: Array<{ label: string; href: string }>;
  limits: {
    crypto?: boolean;
    advancedAnalytics?: boolean;
    premiumAnalytics?: boolean;
    quantToolsAccess?: boolean;
    experimentalStrategies?: boolean;
    maxPresetSwitchesPerWeek?: number | null;
  } | null;
  plans: Array<{ id: PlanTier; name: string; priceMonthly: number; displayPriceMonthly: number; features: string[]; colors: { accent: string; accentDim: string; border: string } }>;
}

interface SubscriptionContextValue {
  entitlements: PlanEntitlements | undefined;
  openUpgradeModal: (reason?: string) => void;
  closeUpgradeModal: () => void;
  checkout: (tier: PlanTier) => Promise<void>;
  changePlan: (tier: PlanTier) => Promise<void>;
  cancelPlan: () => Promise<void>;
  reactivatePlan: () => Promise<void>;
  isUpgrading: boolean;
}

const SubscriptionCtx = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { data: entitlementsRaw } = usePlanEntitlements();
  const entitlements = entitlementsRaw as PlanEntitlements | undefined;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const openUpgradeModal = useCallback((r?: string) => {
    setCheckoutError(null);
    setReason(r);
    setOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setOpen(false);
    setReason(undefined);
    setCheckoutError(null);
  }, []);

  async function postJson(path: string, body: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string | { message?: string };
      };
      const message =
        typeof data.error === 'string'
          ? data.error
          : typeof data.error === 'object' && data.error?.message
            ? data.error.message
            : 'Request failed';
      throw new Error(message);
    }
    return res.json() as Promise<{ data?: { url?: string } }>;
  }

  const checkout = useCallback(async (tier: PlanTier) => {
    if (!entitlements?.billingEnabled) {
      setCheckoutError('Billing is not available right now. Please try again later.');
      return;
    }
    setIsUpgrading(true);
    setCheckoutError(null);
    try {
      const json = await postJson('/api/v1/subscription/checkout', { tier });
      const url = json.data?.url;
      if (url?.startsWith('http')) {
        window.location.href = url;
        return;
      }
      closeUpgradeModal();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setIsUpgrading(false);
    }
  }, [closeUpgradeModal, entitlements?.billingEnabled]);

  const changePlan = useCallback(async (tier: PlanTier) => {
    if (!entitlements?.billingEnabled) {
      setCheckoutError('Billing is not available right now. Please try again later.');
      return;
    }
    setIsUpgrading(true);
    setCheckoutError(null);
    try {
      const json = await postJson('/api/v1/subscription/change', { tier });
      const url = json.data?.url;
      if (url?.startsWith('http')) {
        window.location.href = url;
        return;
      }
      closeUpgradeModal();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Plan change failed');
    } finally {
      setIsUpgrading(false);
    }
  }, [closeUpgradeModal, entitlements?.billingEnabled]);

  const cancelPlan = useCallback(async () => {
    if (!entitlements?.billingEnabled) {
      setCheckoutError('Billing is not available right now. Please try again later.');
      return;
    }
    setIsUpgrading(true);
    try {
      await postJson('/api/v1/subscription/cancel', {});
      closeUpgradeModal();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not cancel subscription');
    } finally {
      setIsUpgrading(false);
    }
  }, [closeUpgradeModal, entitlements?.billingEnabled]);

  const reactivatePlan = useCallback(async () => {
    if (!entitlements?.billingEnabled) {
      setCheckoutError('Billing is not available right now. Please try again later.');
      return;
    }
    setIsUpgrading(true);
    try {
      await postJson('/api/v1/subscription/cancel', { action: 'reactivate' });
      closeUpgradeModal();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not reactivate subscription');
    } finally {
      setIsUpgrading(false);
    }
  }, [closeUpgradeModal, entitlements?.billingEnabled]);

  const value = useMemo(
    () => ({
      entitlements,
      openUpgradeModal,
      closeUpgradeModal,
      checkout,
      changePlan,
      cancelPlan,
      reactivatePlan,
      isUpgrading,
    }),
    [entitlements, openUpgradeModal, closeUpgradeModal, checkout, changePlan, cancelPlan, reactivatePlan, isUpgrading],
  );

  return (
    <SubscriptionCtx.Provider value={value}>
      {children}
      {open && entitlements && (
        <UpgradeModal
          entitlements={entitlements}
          reason={reason}
          onClose={closeUpgradeModal}
          onSelectTier={async (tier) => {
            if (entitlements.currentPlan) {
              await changePlan(tier);
            } else {
              await checkout(tier);
            }
          }}
          onCancel={entitlements.currentPlan ? cancelPlan : undefined}
          onReactivate={entitlements.cancelAtPeriodEnd ? reactivatePlan : undefined}
          loading={isUpgrading}
          billingEnabled={entitlements.billingEnabled}
          error={checkoutError}
        />
      )}
    </SubscriptionCtx.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionCtx);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}

/** Opens upgrade modal when user lacks access; returns false if blocked. */
export function useUpgradeGate() {
  const { entitlements, openUpgradeModal } = useSubscription();
  return useCallback(
    (required: 'live' | 'crypto' | 'quantTools' | 'experimental' | 'advancedAnalytics' | 'premiumAnalytics' | PlanTier, reason?: string) => {
      if (!entitlements) return true;
      const limits = entitlements.limits;
      let allowed = true;
      switch (required) {
        case 'live':
          allowed = entitlements.liveEntitled;
          break;
        case 'crypto':
          allowed = limits?.crypto ?? false;
          break;
        case 'quantTools':
          allowed = limits?.quantToolsAccess ?? false;
          break;
        case 'experimental':
          allowed = limits?.experimentalStrategies ?? false;
          break;
        case 'advancedAnalytics':
          allowed = limits?.advancedAnalytics ?? false;
          break;
        case 'premiumAnalytics':
          allowed = limits?.premiumAnalytics ?? false;
          break;
        default: {
          const tier = entitlements.effectiveTier;
          const rank = { free: 0, essential: 1, pro: 2, unlimited: 3 } as const;
          allowed = rank[tier] >= rank[required as PlanTier];
        }
      }
      if (!allowed) {
        openUpgradeModal(reason);
        return false;
      }
      return true;
    },
    [entitlements, openUpgradeModal],
  );
}
