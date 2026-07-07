/**
 * Machine-readable error codes shared across API routes, client UI, and
 * observability tools (Sentry, PostHog). Every user-visible failure should
 * carry one of these codes plus a refId for support lookup.
 */
export const ErrorCodes = {
  // ── HTTP / API ──
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // ── Billing ──
  BILLING_UNCONFIGURED: 'BILLING_UNCONFIGURED',
  STRIPE_ERROR: 'STRIPE_ERROR',

  // ── Client / UI ──
  UI_RENDER: 'UI_RENDER_ERROR',
  UI_GLOBAL: 'UI_GLOBAL_ERROR',
  API_CLIENT: 'API_CLIENT_ERROR',

  // ── Integrations ──
  CLERK_WEBHOOK_VERIFY: 'CLERK_WEBHOOK_VERIFY_FAILED',
  BOT_USER_CREATE: 'BOT_USER_CREATE_FAILED',
  BOT_CONFIG_SYNC: 'BOT_CONFIG_SYNC_FAILED',
  BOT_CYCLE: 'BOT_CYCLE_FAILED',

  // ── Domain ──
  CONVEX: 'CONVEX_ERROR',
  AUTH: 'AUTH_ERROR',
  MARKET_DATA: 'MARKET_DATA_ERROR',
  BROKER: 'BROKER_ERROR',
  BOT: 'BOT_ERROR',
  SUBSCRIPTION: 'SUBSCRIPTION_ERROR',
  EMAIL: 'EMAIL_ERROR',
  CONFIG: 'CONFIG_ERROR',

  // ── Client runtime ──
  UI_UNHANDLED: 'UI_UNHANDLED_ERROR',
  UI_ROUTE: 'UI_ROUTE_ERROR',

  UNKNOWN: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ErrorPayload {
  code: ErrorCode | string;
  message: string;
  refId?: string;
  details?: unknown;
}

/** Short, human-copyable ID shown to users and tagged in Sentry. */
export function generateErrorRefId(): string {
  const g = globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return `AT-${g.crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AT-${ts}${rand}`;
}

export function extractErrorRefId(err: unknown): string | undefined {
  if (err instanceof TrackedError) return err.refId;
  if (err && typeof err === 'object' && 'refId' in err) {
    const refId = (err as { refId: unknown }).refId;
    if (typeof refId === 'string') return refId;
  }
  return undefined;
}

/** Error with a stable code + refId for UI display and observability. */
export class TrackedError extends Error {
  readonly code: ErrorCode;
  readonly refId: string;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: unknown; details?: unknown; refId?: string },
  ) {
    super(message);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    this.name = 'TrackedError';
    this.code = code;
    this.refId = options?.refId ?? generateErrorRefId();
    this.details = options?.details;
  }
}

export function toTrackedError(
  err: unknown,
  code: ErrorCode = ErrorCodes.UNKNOWN,
  fallbackMessage = 'An unexpected error occurred',
): TrackedError {
  if (err instanceof TrackedError) return err;
  if (err instanceof Error) {
    return new TrackedError(code, err.message, { cause: err });
  }
  return new TrackedError(code, fallbackMessage, { details: err });
}

export function isErrorPayload(value: unknown): value is ErrorPayload {
  return (
    typeof value === 'object'
    && value !== null
    && 'code' in value
    && 'message' in value
    && typeof (value as ErrorPayload).code === 'string'
    && typeof (value as ErrorPayload).message === 'string'
  );
}

/** Duck-type check for engine AppError without importing @autotrade/engine in client bundles. */
export function isAppError(err: unknown): err is Error & { statusCode: number; code: string; details?: unknown } {
  return (
    err instanceof Error
    && typeof (err as { statusCode?: unknown }).statusCode === 'number'
    && typeof (err as { code?: unknown }).code === 'string'
  );
}
