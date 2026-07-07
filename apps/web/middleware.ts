import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/terms',
  '/risk-disclosure',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/v1/webhooks(.*)',
  '/api/health',
  // Cron + internal callers authenticate via CRON_SECRET / x-internal-secret in route handlers.
  '/api/internal(.*)',
  '/api/email(.*)',
  '/ingest(.*)',
  '/api/monitoring',
  '/monitoring(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const { userId } = await auth();
  if (userId) {
    Sentry.setUser({ id: userId });
  }
});

export const config = {
  matcher: [
    '/((?!monitoring|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
