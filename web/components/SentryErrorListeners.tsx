'use client';

import { useEffect } from 'react';
import { ErrorCodes } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';

/** Global browser error hooks — catches errors outside React boundaries. */
export function SentryErrorListeners() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      captureAppError(ErrorCodes.UI_UNHANDLED, event.error ?? event.message, {
        route: window.location.pathname,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      captureAppError(ErrorCodes.UI_UNHANDLED, event.reason, {
        route: window.location.pathname,
        kind: 'unhandledrejection',
      });
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
