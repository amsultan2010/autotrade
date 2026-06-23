import * as Sentry from '@sentry/nextjs';
import { enrichSentryEvent } from './lib/error-tracking';

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: isProd ? 0.2 : 1.0,
  debug: false,
  beforeSend: enrichSentryEvent,
  integrations: [
    Sentry.prismaIntegration(),
  ],
});
