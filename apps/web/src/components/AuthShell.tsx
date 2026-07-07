'use client';

import { AmbientFx } from '@/src/components/AmbientFx';
import { motion, useReducedMotion } from 'framer-motion';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <AmbientFx />
      <div className="lp-hero-glow left-1/2 top-1/4 -translate-x-1/2" aria-hidden />

      <a href="#auth-main" className="skip-link">
        Skip to sign in
      </a>

      <motion.div
        className="relative z-10 w-full max-w-md"
        id="auth-main"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <a
          href="/"
          className="mb-8 flex flex-col items-center gap-3 text-ink transition-opacity hover:opacity-90"
        >
          <motion.img
            src="/icon.png"
            alt=""
            width={48}
            height={48}
            className="rounded-2xl shadow-[var(--shadow-gold-glow)]"
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="font-display text-2xl font-semibold tracking-tight">Autotrade</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
            Trading you control
          </span>
        </a>

        <div className="material-panel p-8 sm:p-10">
          <span className="hud-corners" aria-hidden />
          <p className="mb-6 text-center text-sm leading-relaxed text-ink-secondary">
            AI-driven trading with paper-first onboarding. Go live when you are ready.
          </p>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
