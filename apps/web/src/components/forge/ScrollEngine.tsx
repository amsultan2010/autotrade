'use client';

import { type ReactNode, useRef, useState, useEffect } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
  type Variants,
} from 'framer-motion';
import { cn } from '@/lib/utils';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const forgeFadeUp: Variants = {
  hidden: { opacity: 0, y: 64 },
  show: { opacity: 1, y: 0, transition: { duration: 1.1, ease: EASE } },
};

export const forgeStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
};

export function ForgeReveal({
  children,
  className,
  delay = 0,
  y = 72,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 1.15, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function ForgePinned({
  children,
  className,
  height = '340vh',
  id,
}: {
  children: ReactNode;
  className?: string;
  height?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const scale = useTransform(scrollYProgress, [0, 0.6, 1], reduce ? [1, 1, 1] : [1, 1, 0.97]);
  const opacity = useTransform(scrollYProgress, [0, 0.9, 1], reduce ? [1, 1, 1] : [1, 1, 0.55]);

  return (
    <div ref={ref} id={id} className={className} style={{ height }}>
      <motion.div className="sticky top-0 flex min-h-dvh items-center py-16" style={{ scale, opacity }}>
        {children}
      </motion.div>
    </div>
  );
}

/** Step-through pinned section — one panel at a time as you scroll (desktop). Mobile gets a vertical stack. */
export function ForgeStepPin<T extends { step: string; title: string }>({
  steps,
  height = '420vh',
  id,
  className,
  renderStep,
}: {
  steps: readonly T[];
  height?: string;
  id?: string;
  className?: string;
  renderStep: (step: T, index: number, active: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduce || isMobile) return;
    const idx = Math.min(steps.length - 1, Math.floor(v * steps.length));
    setActive(idx);
  });

  if (reduce || isMobile) {
    return (
      <div id={id} className={className}>
        <div className="lp-pipeline-stack">
          {steps.map((step, i) => (
            <div key={step.step}>{renderStep(step, i, true)}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} id={id} className={cn(className, 'lp-pipeline-pin')} style={{ height }}>
      <div className="sticky top-0 flex min-h-dvh items-center py-20">
        <div className="relative w-full">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{
                opacity: reduce || i === active ? 1 : 0,
                y: reduce || i === active ? 0 : i < active ? -40 : 40,
                scale: reduce || i === active ? 1 : 0.94,
                filter: reduce || i === active ? 'blur(0px)' : 'blur(6px)',
              }}
              transition={{ duration: 0.65, ease: EASE }}
              aria-hidden={i !== active}
            >
              {renderStep(step, i, i === active)}
            </motion.div>
          ))}
          <div className="pointer-events-none invisible" aria-hidden>
            {renderStep(steps[0]!, 0, true)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForgeParallax({
  children,
  className,
  speed = 0.12,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [speed * -36, speed * 36]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

export function ForgeScrollRail({
  children,
  className,
  trackClassName,
}: {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.1'] });
  const x = useTransform(scrollYProgress, [0, 1], reduce ? ['2%', '2%'] : ['3%', '-22%']);

  return (
    <div ref={ref} className={className}>
      <motion.div className={trackClassName} style={{ x }}>
        {children}
      </motion.div>
    </div>
  );
}

export function useForgeScrollProgress(): MotionValue<number> {
  const { scrollYProgress } = useScroll();
  return scrollYProgress;
}

export function ForgeScrollBar() {
  const reduce = useReducedMotion();
  const progress = useForgeScrollProgress();
  if (reduce) return null;
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-[100] h-[3px] origin-left bg-gradient-to-r from-teal via-[#00ffd0] to-red shadow-[0_0_16px_var(--color-teal-glow)]"
      style={{ scaleX: progress }}
      aria-hidden
    />
  );
}
