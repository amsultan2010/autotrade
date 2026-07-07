import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/v1/webhooks(.*)',
  // Convex cron + server-side callers authenticate via x-internal-secret in the route handler.
  '/api/internal(.*)',
  '/api/email(.*)',
  // Analytics / error tunnels must stay public (no Clerk session on beacon requests).
  '/ingest(.*)',
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
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
