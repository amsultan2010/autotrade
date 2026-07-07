import type * as Sentry from '@sentry/nextjs';
import { enrichSentryEvent } from './sentry-enrich';
import { getSentryDsn, getSentryRelease, isSentryEnabled } from './sentry-env';

export { getSentryDsn, getSentryRelease, isSentryEnabled };

function isExpectedNoiseError(message: string): boolean {
  if (message.includes('Billing is not enabled')) return true;
  if (message.includes('Load failed')) return true;
  if (/MarketDataError: Alpaca (401|403)/.test(message)) return true;
  if (/\[CONVEX [QMA]\([^)]+\)\] Server Error/.test(message)) return true;
  if (message.includes('cannot add postgres_changes callbacks')) return true;
  if (/next-client-pages-loader/.test(message)) return true;
  if (/Module not found:.*next-client-pages-loader/.test(message)) return true;
  if (/\bECONNRESET\b/.test(message) || /\baborted\b/i.test(message)) return true;
  return false;
}

function isLegacyConvexError(message: string): boolean {
  return /\[CONVEX [QMA]\([^)]+\)\]/.test(message);
}

function isNoisyConvexClientError(message: string): boolean {
  return isLegacyConvexError(message);
}

function shouldDropSentryEvent(event: Sentry.ErrorEvent): boolean {
  const parts: string[] = [];
  if (event.message) parts.push(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) parts.push(ex.value);
    if (ex.type) parts.push(ex.type);
  }
  if (parts.some((p) => isLegacyConvexError(p) || isNoisyConvexClientError(p) || isExpectedNoiseError(p))) {
    return true;
  }
  // Next.js dev HMR noise captured via console integration.
  if (event.environment === 'development' && parts.some((p) => /Module not found|next-client-pages-loader|Fast Refresh/i.test(p))) {
    return true;
  }
  return false;
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
      'Billing is not enabled',
      'Load failed',
      /MarketDataError: Alpaca (401|403)/,
      /^\[CONVEX [QMA]\([^)]+\)\] Server Error$/,

      'Clerk: ',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      /^Non-Error promise rejection captured/,
      /^\[CONVEX [QMA]\([^)]+\)\]/,
      /TrackedError: \[CONVEX /,
      /ConvexError: \[CONVEX /,
      /cannot add postgres_changes callbacks for realtime:/,
      /next-client-pages-loader/,
      /Module not found:.*next-client-pages-loader/,
    ],
  };
}
