import 'server-only';

import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    });
  }
  return _client;
}

export type AnalyticsEvent =
  | { event: 'bot_started'; properties: { userId: string; mode: string } }
  | { event: 'bot_stopped'; properties: { userId: string } }
  | { event: 'trade_opened'; properties: { userId: string; symbol: string; side: string; mode: string } }
  | { event: 'trade_closed'; properties: { userId: string; symbol: string; pnl: number; mode: string } }
  | { event: 'broker_connected'; properties: { userId: string; broker: string; paper: boolean } }
  | { event: 'settings_updated'; properties: { userId: string; field: string } }
  | { event: 'watchlist_updated'; properties: { userId: string; action: 'add' | 'remove'; symbol: string } }
  | { event: 'signal_generated'; properties: { userId: string; symbol: string; direction: string; confidence: number } }
  | { event: 'subscription_checkout_started'; properties: { userId: string; plan?: string } }
  | { event: 'subscription_upgraded'; properties: { userId: string; plan: string } }
  | { event: 'subscription_canceled'; properties: { userId: string } }
  | { event: 'user_signed_up'; properties: { userId: string; email: string } };

export function capture(userId: string, payload: AnalyticsEvent) {
  const client = getClient();
  if (!client) return;

  client.capture({
    distinctId: userId,
    event: payload.event,
    properties: {
      ...payload.properties,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    },
  });
}

export function captureError(
  userId: string | undefined,
  props: {
    errorCode: string;
    refId: string;
    route?: string;
    message?: string;
    component?: string;
    sentryEventId?: string;
  },
) {
  const client = getClient();
  if (!client) return;

  client.capture({
    distinctId: userId ?? 'anonymous',
    event: 'app_error',
    properties: {
      ...props,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    },
  });
}

export function identifyUser(userId: string, traits: { email?: string; name?: string; role?: string }) {
  const client = getClient();
  if (!client) return;

  client.identify({ distinctId: userId, properties: traits });
}

export async function shutdownAnalytics(): Promise<void> {
  if (!_client) return;
  await _client.shutdown();
  _client = null;
}
