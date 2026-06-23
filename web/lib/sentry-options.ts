import type * as Sentry from '@sentry/nextjs';
import { enrichSentryEvent } from './sentry-enrich';
import { getSentryDsn, getSentryRelease, isSentryEnabled } from './sentry-env';

export { getSentryDsn, getSentryRelease, isSentryEnabled };

export function getBaseSentryOptions(): Sentry.NodeOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const dsn = getSentryDsn();
  const release = getSentryRelease();

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release,
    tracesSampleRate: isProd ? 0.2 : 1.0,
    attachStacktrace: true,
    sendDefaultPii: false,
    maxBreadcrumbs: 100,
    normalizeDepth: 8,
    debug: process.env.SENTRY_DEBUG === 'true',
    beforeSend: enrichSentryEvent,
    ignoreErrors: [
      'Clerk: ',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      /^Non-Error promise rejection captured/,
    ],
  };
}
