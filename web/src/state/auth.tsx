import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import type { SubscriptionInfo } from '@autotrade/shared';

interface AuthState {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  refreshSubscription(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded } = useClerkAuth();

  const subData    = useQuery(convexApi.subscription.get);
  const entitled   = useQuery(convexApi.subscription.isEntitled);
  const paperTrial = useQuery(convexApi.subscription.getPaperTrial);

  const subscription: SubscriptionInfo | null =
    subData !== undefined || entitled !== undefined || paperTrial !== undefined
      ? {
          status: (subData?.status ?? 'NONE') as SubscriptionInfo['status'],
          tier: subData?.tier ?? null,
          currentPeriodEnd: subData?.currentPeriodEnd
            ? new Date(subData.currentPeriodEnd).toISOString()
            : null,
          entitled: entitled ?? false,
          paperTradesUsed: paperTrial?.paperTradesUsed ?? 0,
          paperTradesLimit: 0,
          canUsePaperTrading: paperTrial?.canUsePaperTrading ?? true,
        }
      : null;

  const loading = !isLoaded;

  async function refreshSubscription(): Promise<void> {
    // Convex queries refresh automatically; this is a no-op kept for API compat.
  }

  const value = useMemo(
    () => ({ subscription, loading, refreshSubscription }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscription, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { useUser } from '@clerk/nextjs';
