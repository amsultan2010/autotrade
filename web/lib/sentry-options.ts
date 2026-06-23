import type * as Sentry from '@sentry/nextjs';
import { enrichSentryEvent } from './sentry-enrich';
import { getSentryDsn, getSentryRelease, isSentryEnabled } from './sentry-env';

export { getSentryDsn, getSentryRelease, isSentryEnabled };

function isNoisyConvexClientError(message: string): boolean {
  if (!message.includes('[CONVEX Q(') && !message.includes('[CONVEX M(') && !message.includes('[CONVEX A(')) {
    return false;
  }
  return message.includes('Unauthenticated');
}

function shouldDropSentryEvent(event: Sentry.ErrorEvent): boolean {
  const parts: string[] = [];
  if (event.message) parts.push(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) parts.push(ex.value);
    if (ex.type) parts.push(ex.type);
  }
  return parts.some((p) => isNoisyConvexClientError(p));
}


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
    beforeSend: (event) => {
      if (shouldDropSentryEvent(event)) return null;
      return enrichSentryEvent(event);
    },
    ignoreErrors: [
      'Clerk: ',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      /^Non-Error promise rejection captured/,
      /^\[CONVEX [QMA]\([^)]+\)\] Unauthenticated/,
    ],
  };
}
