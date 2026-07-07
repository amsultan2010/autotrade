'use client';

import { ConstellationBg } from '@/src/components/ConstellationBg';
import { cn } from '@/lib/utils';

type AmbientVariant = 'landing' | 'app' | 'dim';

/** Atmospheric stack — landing gets constellation; app shell stays clean and premium. */
export function HyperForgeAmbient({
  dim = false,
  ghost = false,
  variant,
}: {
  dim?: boolean;
  ghost?: boolean;
  /** `app` = logged-in console (no constellation / grain / scanlines). */
  variant?: AmbientVariant;
}) {
  const resolved: AmbientVariant =
    variant ?? (ghost ? 'app' : dim ? 'dim' : 'landing');

  if (resolved === 'app') {
    return (
      <>
        <div className="fx-grid opacity-[0.02]" aria-hidden />
        <div className="ambient-console-glow" aria-hidden />
        <div
          className="pointer-events-none fixed inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% 20%, rgb(0 200 150 / 0.06) 0%, transparent 55%), radial-gradient(ellipse 100% 90% at 50% 50%, transparent 30%, rgb(3 3 8 / 0.75) 100%)',
          }}
          aria-hidden
        />
      </>
    );
  }

  const scrim =
    resolved === 'dim'
      ? 'radial-gradient(ellipse 95% 75% at 50% 42%, rgb(3 3 8 / 0.4) 0%, rgb(3 3 8 / 0.82) 72%, rgb(3 3 8 / 0.94) 100%)'
      : 'radial-gradient(ellipse 90% 70% at 50% 45%, rgb(3 3 8 / 0.55) 0%, rgb(3 3 8 / 0.92) 72%, rgb(3 3 8 / 0.98) 100%)';

  return (
    <>
      <div className={cn('fx-grid', resolved === 'landing' && 'opacity-[0.025]')} aria-hidden />
      <ConstellationBg mode={resolved === 'dim' ? 'dim' : 'full'} zIndex={0} />
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: scrim }}
        aria-hidden
      />
      <div className="fx-vignette opacity-80" aria-hidden />
      {resolved === 'landing' && <div className="lp-scan-beam opacity-25" aria-hidden />}
    </>
  );
}
