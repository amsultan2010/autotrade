import { join } from 'path';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-inline required by Clerk; avoid unsafe-eval in production builds.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://clerk.tryautotrade.com https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.clerk.com https://tryautotrade.com",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us.posthog.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://clerk.tryautotrade.com https://*.clerk.accounts.dev",
      "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@autotrade/engine', '@autotrade/shared'],
  outputFileTracingRoot: join(__dirname, '../..'),
  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      {
        source: '/',
        destination: '/site/index.html',
      },
      {
        source: '/sign-in/:path*',
        destination: '/site/index.html',
      },
      {
        source: '/sign-up/:path*',
        destination: '/site/index.html',
      },
      ...[
        'privacy',
        'terms',
        'risk-disclosure',
        'dashboard',
        'watchlist',
        'charts',
        'history',
        'settings',
        'account',
        'admin',
      ].map((route) => ({
        source: `/${route}`,
        destination: '/site/index.html',
      })),
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'amsultan2010',
  project: process.env.SENTRY_PROJECT ?? 'javascript-nextjs',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
