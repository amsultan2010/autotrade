'use client';

import { AmbientFx } from '@/src/components/AmbientFx';
import { ForgeReveal } from '@/src/components/forge/ScrollEngine';
import { motion, useReducedMotion } from 'framer-motion';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <AmbientFx variant="app" />
      <div className="lp-hero-glow left-1/2 top-1/4 -translate-x-1/2 opacity-60" aria-hidden />

      <a href="#auth-main" className="skip-link">Skip to sign in</a>

      <ForgeReveal className="relative z-10 w-full max-w-md" y={32}>
        <motion.div
          id="auth-main"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <a href="/" className="mb-8 flex flex-col items-center gap-3 text-ink">
            <motion.img
              src="/icon.png"
              alt=""
              width={56}
              height={56}
              className="rounded-xl border border-teal/30 shadow-[var(--shadow-teal-glow)]"
              animate={reduce ? undefined : { y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <span className="font-display text-2xl font-bold uppercase tracking-widest">Autotrade</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-teal">
              Secure Access Terminal
            </span>
          </a>

          <div className="forge-chassis relative p-8 sm:p-10">
            <span className="forge-bracket" aria-hidden />
            <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
              <span className="forge-led" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                AUTH://CLERK_GATEWAY
              </span>
            </div>
            <p className="mb-6 text-center font-mono text-xs leading-relaxed text-ink-secondary">
              Encrypted session. Paper-first onboarding. Live execution when you authorize.
            </p>
            {children}
          </div>
        </motion.div>
      </ForgeReveal>
    </div>
  );
}
