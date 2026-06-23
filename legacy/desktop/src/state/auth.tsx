import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import type { SubscriptionInfo } from '@autotrade/shared';
import { api } from '../api/client';

interface AuthState {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  refreshSubscription(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [synced, setSynced] = useState(false);

  const refreshSubscription = useCallback(async () => {
    try {
      setSubscription(await api.subscriptionStatus());
    } catch {
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      api.setTokenGetter(null);
      setSynced(true);
      setSubscription(null);
      return;
    }

    (async () => {
      const sessionToken = await getToken();
      if (!sessionToken) { setSynced(true); return; }

      api.setTokenGetter(() => getToken());

      try {
        await api.clerkSync(sessionToken);
        await refreshSubscription();
      } catch {
        // Backend may not be running; still allow UI to proceed.
      } finally {
        setSynced(true);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, refreshSubscription]);

  const loading = !isLoaded || !synced;

  const value = useMemo(
    () => ({ subscription, loading, refreshSubscription }),
    [subscription, loading, refreshSubscription],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { useUser };
