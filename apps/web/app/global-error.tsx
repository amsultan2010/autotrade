'use client';

import { useEffect, useMemo } from 'react';
import { ErrorCodes, toTrackedError } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';
import { ErrorFallback } from '@/src/components/ErrorFallback';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const tracked = useMemo(
    () => toTrackedError(error, ErrorCodes.UI_GLOBAL, error.message),
    [error],
  );

  useEffect(() => {
    captureAppError(ErrorCodes.UI_GLOBAL, error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorFallback
          error={tracked}
          digest={error.digest}
          onRetry={() => window.location.reload()}
          retryLabel="Reload page"
        />
      </body>
    </html>
  );
}
