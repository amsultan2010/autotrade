import { ErrorCodes } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) => {
  const [err, request, context] = args;
  const digest = context && 'digest' in context ? String(context.digest) : undefined;
  captureAppError(ErrorCodes.INTERNAL, err, {
    route: request.path,
    method: request.method,
    digest,
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureRequestError(...args);
  }
};
