'use client';

import { useEffect } from 'react';
import { ErrorCodes } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';

function isNoisyConvexClientError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  if (!msg.includes('[CONVEX Q(') && !msg.includes('[CONVEX M(') && !msg.includes('[CONVEX A(')) {
    return false;
  }
  return msg.includes('Unauthenticated');
}

/** Global browser error hooks  -  catches errors outside React boundaries. */
export function SentryErrorListeners() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error ?? event.message;
      if (isNoisyConvexClientError(err)) return;
      captureAppError(ErrorCodes.UI_UNHANDLED, err, {
        route: window.location.pathname,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
      void import('@sentry/nextjs').then(({ flush }) => flush(2000)).catch(() => undefined);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isNoisyConvexClientError(event.reason)) return;
      captureAppError(ErrorCodes.UI_UNHANDLED, event.reason, {
        route: window.location.pathname,
        kind: 'unhandledrejection',
      });
      void import('@sentry/nextjs').then(({ flush }) => flush(2000)).catch(() => undefined);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
