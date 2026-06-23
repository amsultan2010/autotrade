import type * as Sentry from '@sentry/nextjs';
import { enrichSentryEvent } from './error-tracking';

export function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
}

export function getBaseSentryOptions(): Sentry.NodeOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const dsn = getSentryDsn();

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: isProd ? 0.2 : 1.0,
    attachStacktrace: true,
    sendDefaultPii: false,
    debug: process.env.SENTRY_DEBUG === 'true',
    beforeSend: enrichSentryEvent,
    ignoreErrors: [
      'Clerk: ',
      'ResizeObserver loop limit exceeded',
    ],
  };
}
