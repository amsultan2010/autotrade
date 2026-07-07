'use client';

import { ConstellationBg } from '@/src/components/ConstellationBg';
import { ScanlineOverlay } from '@/src/components/ScanlineOverlay';

/** Full-screen atmospheric layers: particles, grain, vignette, scanlines. */
export function AmbientFx({ dim = false }: { dim?: boolean }) {
  return (
    <>
      <ConstellationBg dim={dim} zIndex={0} />
      <ScanlineOverlay />
    </>
  );
}
