'use client';

import { useMemo } from 'react';
import { ErrorCodes } from '@autotrade/shared';
import { reportTrackedError } from '@/lib/error-tracking';
import { ErrorFallback } from '@/src/components/ErrorFallback';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const tracked = useMemo(
    () => reportTrackedError(ErrorCodes.UI_GLOBAL, error, { digest: error.digest }, error.message),
    [error],
  );

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
