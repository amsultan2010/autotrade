
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import type { SubscriptionInfo } from '@autotrade/shared';
import { useSubscriptionData } from '@/src/hooks/data';

interface AuthState {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  refreshSubscription(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { data: subData, loading: subLoading, refresh } = useSubscriptionData();

  const subscription: SubscriptionInfo | null = subData
    ? {
        status: subData.status as SubscriptionInfo['status'],
        tier: subData.tier,
        currentPeriodEnd: subData.currentPeriodEnd,
        entitled: subData.entitled,
        paperTradesUsed: subData.paperTradesUsed,
        paperTradesLimit: subData.paperTradesLimit,
        canUsePaperTrading: subData.canUsePaperTrading,
      }
    : null;

  const loading = !isLoaded || (isSignedIn && subLoading);

  async function refreshSubscription(): Promise<void> {
    await refresh();
  }

  const value = useMemo(
    () => ({ subscription, loading, refreshSubscription }),
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
