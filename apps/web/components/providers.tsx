'use client';

import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useMutation } from 'convex/react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

// Ensures the Convex user record (+ botSettings, paperAccount, subscription)
// exists for the current user. Guards against the Clerk webhook being missed
// on sign-up so the app never shows a blank/broken state.
function UserSync() {
  const { user, isLoaded } = useUser();
  const ensureExists = useMutation(api.users.ensureExists);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;
    ensureExists({ email }).catch(() => {
      // Best-effort — failure is non-fatal; webhook already covers the happy path.
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

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
