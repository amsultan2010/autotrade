'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Warm golden-hour atmosphere inspired by editorial energy brands. */
export function SunriseAmbient({ subtle = false }: { subtle?: boolean }) {
  const reduce = useReducedMotion();
  const opacity = subtle ? 0.45 : 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -20%, #FFF4E8 0%, transparent 55%), linear-gradient(180deg, #FAF7F2 0%, #F3EDE4 100%)',
        }}
      />
      <motion.div
        className="absolute -left-[10%] top-[8%] h-[min(520px,70vw)] w-[min(520px,70vw)] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(255, 122, 26, 0.35), transparent 68%)',
          opacity,
        }}
        animate={reduce ? undefined : { x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-[8%] top-[22%] h-[min(440px,60vw)] w-[min(440px,60vw)] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(255, 180, 100, 0.28), transparent 70%)',
          opacity,
        }}
        animate={reduce ? undefined : { x: [0, -20, 0], y: [0, 14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute bottom-[12%] left-[30%] h-[min(380px,50vw)] w-[min(380px,50vw)] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(232, 93, 4, 0.18), transparent 72%)',
          opacity: opacity * 0.85,
        }}
        animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <div className="fx-grain-light" />
      <div className="fx-vignette-light" />
    </div>
  );
}
