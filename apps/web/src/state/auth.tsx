import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
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
  const { isLoaded, isSignedIn } = useClerkAuth();

  const subData  = useQuery(convexApi.subscription.get);
  const entitled = useQuery(convexApi.subscription.isEntitled);

  const subscription: SubscriptionInfo | null =
    subData !== undefined || entitled !== undefined
      ? {
          status: (subData?.status ?? 'NONE') as SubscriptionInfo['status'],
          tier: subData?.tier ?? null,
          currentPeriodEnd: subData?.currentPeriodEnd
            ? new Date(subData.currentPeriodEnd).toISOString()
            : null,
          entitled: entitled ?? false,
        }
      : null;

  const loading = !isLoaded || (isSignedIn && subData === undefined);

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

export { useUser };
