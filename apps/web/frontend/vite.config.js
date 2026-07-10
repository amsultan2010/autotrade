import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));
const webRoot = resolve(frontendRoot, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, '');
  let clerkPublishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

  if (!clerkPublishableKey) {
    try {
      const keyless = JSON.parse(
        readFileSync(resolve(webRoot, '.clerk/.tmp/keyless.json'), 'utf8'),
      );
      clerkPublishableKey =
        keyless.publishableKey ?? keyless.publishable_key ?? '';
    } catch {
      // Clerk creates this file automatically in local keyless mode.
    }
  }

  return {
    root: frontendRoot,
    publicDir: false,
    base: '/site/',
    define: {
      __CLERK_PUBLISHABLE_KEY__: JSON.stringify(clerkPublishableKey),
      __POSTHOG_KEY__: JSON.stringify(env.NEXT_PUBLIC_POSTHOG_KEY ?? ''),
      __POSTHOG_HOST__: JSON.stringify(env.NEXT_PUBLIC_POSTHOG_HOST ?? '/ingest'),
    },
    build: {
      outDir: resolve(webRoot, 'public/site'),
      emptyOutDir: true,
      assetsDir: 'assets',
      sourcemap: false,
    },
  };
});
