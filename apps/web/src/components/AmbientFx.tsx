'use client';

import { HyperForgeAmbient } from '@/src/components/HyperForgeAmbient';

export function AmbientFx({
  dim = false,
  ghost = false,
  variant,
}: {
  dim?: boolean;
  ghost?: boolean;
  /** Logged-in app shell — no constellation or vintage noise. */
  variant?: 'landing' | 'app' | 'dim';
}) {
  return <HyperForgeAmbient dim={dim} ghost={ghost} variant={variant} />;
}
