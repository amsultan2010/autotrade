import 'server-only';

import type { ErrorCode } from '@autotrade/shared';
import { captureError } from '@/lib/analytics';
import { captureAppError, type CaptureContext } from '@/lib/error-tracking';

/** Server routes: Sentry + PostHog Node. Do not import from client components. */
export function captureAppErrorServer(
  code: ErrorCode,
  err: unknown,
  context?: CaptureContext,
): string {
  const refId = captureAppError(code, err, context);
  captureError(typeof context?.userId === 'string' ? context.userId : undefined, {
    errorCode: code,
    refId,
    route: context?.route,
    message: err instanceof Error ? err.message : undefined,
    component: context?.component,
  });
  return refId;
}
