import * as Sentry from '@sentry/nextjs';
import { getBaseSentryOptions } from './lib/sentry-options';

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  ...getBaseSentryOptions(),
  replaysSessionSampleRate: isProd ? 0.05 : 0,
  replaysOnErrorSampleRate: isProd ? 1.0 : 0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
