'use client';

import { ConstellationBg } from '@/src/components/ConstellationBg';
import { ScanlineOverlay } from '@/src/components/ScanlineOverlay';
import { cn } from '@/lib/utils';

type AmbientMode = 'full' | 'dim' | 'ghost';

/** Atmospheric stack with readability scrim for foreground panels. */
export function HyperForgeAmbient({
  dim = false,
  ghost = false,
}: {
  dim?: boolean;
  ghost?: boolean;
}) {
  const mode: AmbientMode = ghost ? 'ghost' : dim ? 'dim' : 'full';
  const scrim =
    mode === 'ghost'
      ? 'radial-gradient(ellipse 100% 80% at 50% 40%, rgb(3 3 8 / 0.25) 0%, rgb(3 3 8 / 0.72) 75%, rgb(3 3 8 / 0.88) 100%)'
      : mode === 'dim'
        ? 'radial-gradient(ellipse 95% 75% at 50% 42%, rgb(3 3 8 / 0.4) 0%, rgb(3 3 8 / 0.82) 72%, rgb(3 3 8 / 0.94) 100%)'
        : 'radial-gradient(ellipse 90% 70% at 50% 45%, rgb(3 3 8 / 0.55) 0%, rgb(3 3 8 / 0.92) 72%, rgb(3 3 8 / 0.98) 100%)';

  return (
    <>
      <div className={cn('fx-grid', mode === 'ghost' && 'opacity-[0.012]')} aria-hidden />
      <ConstellationBg mode={mode} zIndex={0} />
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: scrim }}
        aria-hidden
      />
      <ScanlineOverlay className={mode === 'ghost' ? 'opacity-[0.02]' : undefined} />
      <div className={cn('fx-grain', mode === 'ghost' && 'opacity-[0.02]')} aria-hidden />
      <div className="fx-vignette" aria-hidden />
      {mode === 'full' && <div className="lp-scan-beam opacity-40" aria-hidden />}
    </>
  );
}
