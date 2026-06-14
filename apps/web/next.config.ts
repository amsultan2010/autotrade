import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@autotrade/engine', '@autotrade/shared'],
  serverExternalPackages: ['argon2', '@prisma/client', 'prisma'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
