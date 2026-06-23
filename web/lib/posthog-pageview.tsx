'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const { user, isLoaded } = useUser();

  // Identify + set user properties when Clerk user loads
  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        role: user.publicMetadata?.role,
        created_at: user.createdAt,
        username: user.username,
      });
    } else {
      posthog.reset();
    }
  }, [isLoaded, user?.id, posthog]);

  // Capture pageview on every route change
  useEffect(() => {
    if (!pathname || !posthog?.__loaded) return;
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
