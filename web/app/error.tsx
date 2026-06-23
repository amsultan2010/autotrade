'use client';

import { useMemo } from 'react';
import { ErrorCodes } from '@autotrade/shared';
import { reportTrackedError } from '@/lib/error-tracking';
import { ErrorFallback } from '@/src/components/ErrorFallback';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tracked = useMemo(
    () => reportTrackedError(
      ErrorCodes.UI_ROUTE,
      error,
      { digest: error.digest, route: typeof window !== 'undefined' ? window.location.pathname : undefined },
      error.message,
    ),
    [error],
  );

  return (
    <ErrorFallback
      error={tracked}
      digest={error.digest}
      onRetry={reset}
    />
  );
}
