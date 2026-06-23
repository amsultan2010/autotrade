import * as Sentry from '@sentry/nextjs';
import {
  type ErrorCode,
  ErrorCodes,
  extractErrorRefId,
  generateErrorRefId,
  toTrackedError,
  TrackedError,
  type ErrorPayload,
} from '@autotrade/shared';
import { AppError } from '@autotrade/engine/public';
import { isSentryEnabled } from '@/lib/sentry-options';

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

function captureServerError(code: ErrorCode, refId: string, context?: CaptureContext): void {
  if (typeof window !== 'undefined') return;
  void import('@/lib/analytics')
    .then(({ captureError }) => {
      captureError(typeof context?.userId === 'string' ? context.userId : undefined, {
        errorCode: code,
        refId,
        route: context?.route,
        message: typeof context?.message === 'string' ? context.message : undefined,
        component: context?.component,
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
      const eventId = Sentry.captureException(exception);
      if (eventId && typeof window === 'undefined') {
        scope.setTag('sentry_event_id', eventId);
      }
    });
  } else if (process.env.NODE_ENV === 'development') {
    console.error('[error-tracking] Sentry disabled — no DSN configured', {
      code: resolvedCode,
      refId,
      message,
      context,
    });
  }

  capturePostHog(resolvedCode, refId, context);
  captureServerError(resolvedCode, refId, context);
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

export function enrichSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const ctx = event.contexts?.error as {
    code?: string;
    refId?: string;
    message?: string;
    route?: string;
    component?: string;
    digest?: string;
  } | undefined;
  const code = event.tags?.error_code ?? ctx?.code;
  if (typeof code === 'string' && !event.tags?.error_code) {
    event.tags = { ...event.tags, error_code: code };
  }
  if (ctx?.refId && !event.tags?.error_ref_id) {
    event.tags = { ...event.tags, error_ref_id: ctx.refId };
  }
  if (ctx?.route && !event.tags?.route) {
    event.tags = { ...event.tags, route: ctx.route };
  }
  if (ctx?.component && !event.tags?.component) {
    event.tags = { ...event.tags, component: ctx.component };
  }
  if (ctx?.message && event.message && !event.message.includes(ctx.message)) {
    const codeLabel = typeof code === 'string' ? code : 'ERROR';
    event.message = `[${codeLabel}] ${ctx.message}`;
  }
  if (event.exception?.values?.[0]) {
    const top = event.exception.values[0];
    if (ctx?.refId) {
      top.value = `${top.value ?? 'Error'} (ref: ${ctx.refId})`;
    }
    if (typeof code === 'string' && top.type && !top.type.includes(code)) {
      event.fingerprint = event.fingerprint ?? [code, ctx?.route ?? ctx?.component ?? 'app'];
    }
  }
  return event;
}

export function asTrackedError(err: Error, code: ErrorCode): TrackedError {
  return toTrackedError(err, code);
}

export { ErrorCodes };
