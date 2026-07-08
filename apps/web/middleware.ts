import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { clientIp, rateLimit } from '@/lib/rate-limit';

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

const isApiRoute = createRouteMatcher(['/api(.*)']);

function applyApiRateLimit(req: NextRequest): NextResponse | null {
  if (!isApiRoute(req)) return null;
  // Webhooks and health must not be blocked by IP limits (providers retry).
  const path = req.nextUrl.pathname;
  if (
    path.startsWith('/api/v1/webhooks') ||
    path === '/api/health' ||
    path.startsWith('/api/internal')
  ) {
    return null;
  }

  const ip = clientIp(req);
  const isSensitive =
    path.startsWith('/api/v1/broker') ||
    path.startsWith('/api/v1/bot') ||
    path.startsWith('/api/email') ||
    path.startsWith('/api/v1/subscription/checkout') ||
    path.startsWith('/api/v1/trades/close') ||
    path.startsWith('/api/v1/trades/cash-out');

  const result = rateLimit(`api:${ip}:${isSensitive ? 'sensitive' : 'general'}`, {
    limit: isSensitive ? 30 : 120,
    windowMs: 60_000,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
        },
      },
    );
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const limited = applyApiRateLimit(req);
  if (limited) return limited;

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
