'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogUiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? 'https://us.posthog.com';

export const posthogClientOptions = {
  api_host: '/ingest',
  ui_host: posthogUiHost,
  person_profiles: 'identified_only' as const,
  capture_pageview: false,
  capture_pageleave: true,
  capture_exceptions: true,
  autocapture: true,
  persistence: 'localStorage+cookie' as const,
};

export function isPostHogEnabled(): boolean {
  return Boolean(posthogKey);
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!posthogKey || posthog.__loaded) return;

    posthog.init(posthogKey, {
      ...posthogClientOptions,
      loaded: (client) => {
        if (process.env.NODE_ENV === 'development') {
          client.debug(false);
        }
      },
    });
  }, []);

  if (!posthogKey) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
