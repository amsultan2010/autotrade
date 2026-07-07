'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const SupabaseCtx = createContext<SupabaseClient | null>(null);

function UserSync() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const syncedRef = useRef(false);
  const welcomeSentRef = useRef(false);

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email || syncedRef.current) return;
    syncedRef.current = true;

    fetch('/api/v1/auth/clerk-sync', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('sync failed');
        const body = (await res.json()) as { shouldSendWelcome?: boolean };
        if (body.shouldSendWelcome && !welcomeSentRef.current) {
          welcomeSentRef.current = true;
          void fetch('/api/email/welcome-onboarding', { method: 'POST' }).catch(() => {});
        }
      })
      .catch(() => {
        syncedRef.current = false;
      });
  }, [clerkLoaded, isSignedIn, user?.id]);

  return null;
}

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const clientRef = useRef<SupabaseClient | null>(null);
  if (isLoaded && !clientRef.current) {
    clientRef.current = createSupabaseBrowserClient((opts) => getTokenRef.current(opts));
  }

  const client = clientRef.current;

  if (!client) return <>{children}</>;

  return (
    <SupabaseCtx.Provider value={client}>
      {isSignedIn && <UserSync />}
      {children}
    </SupabaseCtx.Provider>
  );
}

export function useSupabase(): SupabaseClient {
  const client = useContext(SupabaseCtx);
  if (!client) throw new Error('useSupabase must be used within SupabaseProvider');
  return client;
}
