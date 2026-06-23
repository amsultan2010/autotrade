import * as Sentry from '@sentry/nextjs';
import {
  type ErrorCode,
  ErrorCodes,
  extractErrorRefId,
  generateErrorRefId,
  toTrackedError,
  type TrackedError,
} from '@autotrade/shared';
import { AppError } from '@autotrade/engine/public';

export interface CaptureContext {
  route?: string;
  component?: string;
  componentStack?: string | null;
  userId?: string;
  digest?: string;
  [key: string]: unknown;
}

function resolveCode(err: unknown, fallback: ErrorCode): ErrorCode {
  if (err instanceof AppError) return err.code as ErrorCode;
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string') return code as ErrorCode;
  }
  return fallback;
}

function resolveMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}

function capturePostHog(code: ErrorCode, refId: string, context?: CaptureContext): void {
  if (typeof window === 'undefined') return;
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.capture('app_error', {
        error_code: code,
        error_ref_id: refId,
        route: context?.route,
        component: context?.component,
        digest: context?.digest,
      });
    })
    .catch(() => undefined);
}

function captureServerError(code: ErrorCode, refId: string, context?: CaptureContext): void {
  if (typeof window !== 'undefined') return;
  void import('@/lib/analytics')
    .then(({ captureError }) => {
      captureError(typeof context?.userId === 'string' ? context.userId : undefined, {
        errorCode: code,
        refId,
        route: context?.route,
      });
    })
    .catch(() => undefined);
}

/**
 * Capture an error to Sentry (and PostHog on the client) with a stable code,
 * refId, and fingerprint. Returns the refId for user-facing display.
 */
export function captureAppError(
  code: ErrorCode,
  err: unknown,
  context?: CaptureContext,
): string {
  const refId = extractErrorRefId(err) ?? generateErrorRefId();
  const resolvedCode = resolveCode(err, code);
  const message = resolveMessage(err);

  Sentry.withScope((scope) => {
    scope.setTag('error_code', resolvedCode);
    scope.setTag('error_ref_id', refId);
    if (context?.route) scope.setTag('route', context.route);
    if (context?.component) scope.setTag('component', context.component);
    if (context?.digest) scope.setTag('next_digest', context.digest);
    if (context?.userId) scope.setUser({ id: context.userId });

    scope.setFingerprint([resolvedCode, context?.route ?? context?.component ?? 'app']);
    scope.setContext('error', {
      refId,
      code: resolvedCode,
      message,
      ...context,
    });

    const exception = err instanceof Error ? err : new Error(message);
    Sentry.captureException(exception);
  });

  capturePostHog(resolvedCode, refId, context);
  captureServerError(resolvedCode, refId, context);
  return refId;
}

export function enrichSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const code = event.tags?.error_code ?? event.contexts?.error?.code;
  if (typeof code === 'string' && !event.tags?.error_code) {
    event.tags = { ...event.tags, error_code: code };
  }
  return event;
}

export function asTrackedError(err: Error, code: ErrorCode): TrackedError {
  return toTrackedError(err, code);
}

export { ErrorCodes };
