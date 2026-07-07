import * as Sentry from '@sentry/nextjs';
import {
  type ErrorCode,
  ErrorCodes,
  extractErrorRefId,
  generateErrorRefId,
  isAppError,
  toTrackedError,
  TrackedError,
  type ErrorPayload,
} from '@autotrade/shared';
import { isSentryEnabled } from '@/lib/sentry-env';

export interface CaptureContext {
  route?: string;
  component?: string;
  componentStack?: string | null;
  userId?: string;
  digest?: string;
  [key: string]: unknown;
}

function resolveCode(err: unknown, fallback: ErrorCode): ErrorCode {
  if (isAppError(err)) return err.code as ErrorCode;
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
      if (!posthog.__loaded) return;
      const sessionId = posthog.get_session_id?.();
      posthog.capture('app_error', {
        error_code: code,
        error_ref_id: refId,
        route: context?.route,
        component: context?.component,
        digest: context?.digest,
        posthog_session_id: sessionId,
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

  if (isSentryEnabled()) {
    Sentry.withScope((scope) => {
      scope.setLevel('error');
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

      const exception = err instanceof Error ? err : new Error(`[${resolvedCode}] ${message}`);
      const taggedMessage = `[${resolvedCode}] ${message} (ref: ${refId})`;
      if (!exception.message.includes(refId)) {
        exception.message = taggedMessage;
      }

      const eventId = Sentry.captureException(exception);
      if (eventId && typeof window === 'undefined') {
        scope.setTag('sentry_event_id', eventId);
      }
      if (typeof window !== 'undefined') {
        void Sentry.flush(2000);
      }
    });
  }

  capturePostHog(resolvedCode, refId, context);
  return refId;
}

/** Create a TrackedError, capture it, and return it for UI display. */
export function reportTrackedError(
  code: ErrorCode,
  err: unknown,
  context?: CaptureContext,
  fallbackMessage = 'An unexpected error occurred',
): TrackedError {
  const tracked = toTrackedError(err, code, fallbackMessage);
  const refId = captureAppError(code, tracked, context);
  if (tracked.refId !== refId) {
    return new TrackedError(tracked.code, tracked.message, {
      cause: tracked.cause,
      details: tracked.details,
      refId,
    });
  }
  return tracked;
}

export function formatUserError(err: unknown, fallback = 'Something went wrong'): string {
  const message = err instanceof Error ? err.message : null;
  if (message) return message;

  if (err instanceof TrackedError) {
    return `[${err.code}] ${err.message} (ref: ${err.refId})`;
  }
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const payload = err as ErrorPayload;
    const ref = payload.refId ? ` (ref: ${payload.refId})` : '';
    return `[${payload.code}] ${payload.message}${ref}`;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export { ErrorCodes };
