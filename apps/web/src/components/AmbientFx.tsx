'use client';

import { HyperForgeAmbient } from '@/src/components/HyperForgeAmbient';

export function AmbientFx({
  dim = false,
  ghost = false,
}: {
  dim?: boolean;
  ghost?: boolean;
}) {
  return <HyperForgeAmbient dim={dim} ghost={ghost} />;
}
