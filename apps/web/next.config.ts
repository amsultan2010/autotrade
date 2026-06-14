import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@autotrade/engine', '@autotrade/shared'],
  experimental: {
    serverComponentsExternalPackages: ['argon2', '@prisma/client', 'prisma'],
  },
};

export default nextConfig;
