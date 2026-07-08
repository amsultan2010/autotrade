'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

const LENIS_OPTIONS = {
  autoRaf: true,
  lerp: 0.09,
  smoothWheel: true,
  wheelMultiplier: 0.92,
  touchMultiplier: 1,
  /** Native touch scroll on mobile — Lenis touch smoothing often feels jittery. */
  syncTouch: false,
  overscroll: true,
} as const;

/** Lenis only on the marketing page; app routes use native scroll for stability. */
function useLenisEnabled(): boolean {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  if (reduce) return false;
  if (pathname !== '/') return false;
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    return false;
  }
  return true;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const enabled = useLenisEnabled();

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      {children}
    </ReactLenis>
  );
}
