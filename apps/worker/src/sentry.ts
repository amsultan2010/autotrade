import * as Sentry from '@sentry/node';

let initialized = false;

export function initWorkerSentry(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      const parts: string[] = [];
      if (event.message) parts.push(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) parts.push(ex.value);
      }
      if (parts.some((p) => /\[CONVEX [QMA]\(/.test(p) || /next-client-pages-loader/.test(p))) {
        return null;
      }
      return event;
    },
  });
  initialized = true;
}

export function captureWorkerError(err: unknown, context?: Record<string, unknown>): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (!initialized) initWorkerSentry();
  Sentry.withScope((scope) => {
    scope.setTag('service', 'worker');
    if (context) scope.setContext('worker', context);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}
