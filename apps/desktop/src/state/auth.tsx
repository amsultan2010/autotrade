import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser, SubscriptionInfo } from '@alphabot/shared';
import { api } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshSubscription(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    try {
      setSubscription(await api.subscriptionStatus());
    } catch {
      setSubscription(null);
    }
  }, []);

  const afterAuth = useCallback(
    async (u: AuthUser) => {
      setUser(u);
      await refreshSubscription();
    },
    [refreshSubscription],
  );

  useEffect(() => {
    (async () => {
      const restored = await api.restoreSession();
      if (restored) await afterAuth(restored);
      setLoading(false);
    })();
  }, [afterAuth]);

  const login = useCallback(
    async (email: string, password: string) => afterAuth(await api.login(email, password)),
    [afterAuth],
  );
  const register = useCallback(
    async (email: string, password: string) => afterAuth(await api.register(email, password)),
    [afterAuth],
  );
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setSubscription(null);
  }, []);

  const value = useMemo(
    () => ({ user, subscription, loading, login, register, logout, refreshSubscription }),
    [user, subscription, loading, login, register, logout, refreshSubscription],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
