import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
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
  const { user } = useUser();

  // Self-heal: ensure this signed-in user has their Convex records
  // (users/botSettings/paperAccount/subscription). The Clerk webhook seeds
  // these on sign-up, but accounts created before the webhook existed — or any
  // time the webhook fails to fire — would otherwise have no settings, leaving
  // the Settings page stuck loading and the bot unable to start. ensureExists
  // is idempotent server-side, so calling it once per session is safe.
  const ensureExists = useMutation(convexApi.users.ensureExists);
  const syncedRef = useRef(false);
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  useEffect(() => {
    if (!isSignedIn || !email || syncedRef.current) return;
    syncedRef.current = true;
    ensureExists({ email }).catch(() => {
      // Allow a retry on a later render if the first attempt failed.
      syncedRef.current = false;
    });
  }, [isSignedIn, email, ensureExists]);

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

export { useUser };
