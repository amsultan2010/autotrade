'use client';

import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useConvexAuth, useMutation } from 'convex/react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

// Ensures the Convex user record (+ botSettings, paperAccount, subscription)
// exists for the current user. Guards against the Clerk webhook being missed
// on sign-up so the app never shows a blank/broken state.
function UserSync() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const ensureExists = useMutation(api.users.ensureExists);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!clerkLoaded || convexAuthLoading || !isAuthenticated || !user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email || syncedRef.current) return;
    syncedRef.current = true;
    ensureExists({ email }).catch(() => {
      // Best-effort — allow retry if Convex auth wasn't ready yet.
      syncedRef.current = false;
    });
  }, [clerkLoaded, convexAuthLoading, isAuthenticated, user?.id, ensureExists]);

  return null;
}

export function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSync />
      {children}
    </ConvexProviderWithClerk>
  );
}
