'use client';

import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import { useReducedMotion } from 'framer-motion';

/** Premium smooth scroll — slower, heavier feel. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;

    const lenis = new Lenis({
      duration: 2.1,
      easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.1,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduce]);

  return <>{children}</>;
}
