'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

if (typeof window !== 'undefined' && posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    loaded: (client) => {
      if (process.env.NODE_ENV === 'development') {
        client.debug(false);
      }
    },
  });
}

export function isPostHogEnabled(): boolean {
  return Boolean(posthogKey);
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!posthogKey) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
