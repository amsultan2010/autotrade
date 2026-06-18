import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@autotrade/engine', '@autotrade/shared'],
  serverExternalPackages: ['argon2', '@prisma/client', 'prisma'],
  webpack: (config) => {
    config.externals = [...(Array.isArray(config.externals) ? config.externals : []), 'argon2'];
    return config;
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
