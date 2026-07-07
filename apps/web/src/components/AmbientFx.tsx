'use client';

import { SunriseAmbient } from '@/src/components/SunriseAmbient';

/** Full-screen warm atmospheric layers — golden hour, soft grain, lens warmth. */
export function AmbientFx({ dim = false }: { dim?: boolean }) {
  return <SunriseAmbient subtle={dim} />;
}
