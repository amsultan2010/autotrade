'use client';

import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ForgeReveal } from '@/src/components/forge/ScrollEngine';

/** Heavy metal plate with rivets — readable foreground over ambient FX. */
export function ForgePlate({
  children,
  className,
  glow = 'teal',
}: {
  children: ReactNode;
  className?: string;
  glow?: 'teal' | 'red' | 'none';
}) {
  return (
    <div
      className={cn(
        'forge-plate relative',
        glow === 'teal' && 'forge-plate-teal',
        glow === 'red' && 'forge-plate-red',
        className,
      )}
    >
      <span className="forge-rivet forge-rivet-tl" aria-hidden />
      <span className="forge-rivet forge-rivet-tr" aria-hidden />
      <span className="forge-rivet forge-rivet-bl" aria-hidden />
      <span className="forge-rivet forge-rivet-br" aria-hidden />
      <span className="forge-bracket" aria-hidden />
      {children}
    </div>
  );
}

/** Inset LCD readout bezel. */
export function ForgeLCD({
  label,
  value,
  unit,
  variant = 'teal',
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  variant?: 'teal' | 'red' | 'amber';
  className?: string;
}) {
  return (
    <div className={cn('forge-lcd', variant === 'red' && 'forge-lcd-red', variant === 'amber' && 'forge-lcd-amber', className)}>
      <p className="forge-lcd-label">{label}</p>
      <p className="forge-lcd-value tabular-nums">
        {value}
        {unit && <span className="forge-lcd-unit">{unit}</span>}
      </p>
    </div>
  );
}

/** Decorative arc gauge. */
export function ForgeGauge({
  label,
  pct,
  color = '#00c896',
}: {
  label: string;
  pct: number;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c * 0.75;

  return (
    <div className="forge-gauge">
      <svg viewBox="0 0 96 96" className="h-24 w-24" aria-hidden>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="6" strokeDasharray={`${c * 0.75} ${c}`} transform="rotate(135 48 48)" />
        <motion.circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.75} ${c}`}
          transform="rotate(135 48 48)"
          initial={reduce ? false : { strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <p className="mt-1 text-center font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="text-center font-mono text-sm font-bold tabular-nums" style={{ color }}>{pct}%</p>
    </div>
  );
}

/** Stacked instrument tower for hero. */
export function InstrumentTower() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col gap-3"
      initial={reduce ? false : { opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <ForgePlate className="p-4" glow="teal">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">PORTFOLIO</span>
          <span className="forge-led" />
        </div>
        <ForgeLCD label="EQUITY" value="$124,832" variant="teal" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ForgeLCD label="DAY P&L" value="+$1,842" variant="teal" />
          <ForgeLCD label="DRAWDOWN" value="-2.1" unit="%" variant="red" />
        </div>
      </ForgePlate>

      <ForgePlate className="p-4">
        <div className="flex items-center justify-between gap-4">
          <ForgeGauge label="Win rate" pct={68} color="#00c896" />
          <ForgeGauge label="Risk load" pct={34} color="#ff3b52" />
          <ForgeGauge label="Scan" pct={92} color="#00ffd0" />
        </div>
      </ForgePlate>

      <ForgePlate className="p-3" glow="red">
        <div className="forge-terminal-crawl font-mono text-[10px] leading-relaxed text-teal/80" aria-hidden>
          {[
            '> SCAN::NVDA momentum spike +3.67%',
            '> SIGNAL::BUY conf 0.87 entry 138.20',
            '> ROUTE::ALPACA fill 47ms slippage 0.02%',
            '> RISK::position within sector cap',
            '> MANAGE::trail stop armed @ 136.40',
          ].map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </ForgePlate>
    </motion.div>
  );
}

/** Zigzag module row — alternates alignment dramatically. */
export function ZigzagModule({
  index,
  title,
  desc,
  Icon: Icon,
  accent,
  children,
}: {
  index: number;
  title: string;
  desc: string;
  Icon: LucideIcon;
  accent: string;
  children?: ReactNode;
}) {
  const flip = index % 2 === 1;
  return (
    <ForgeReveal>
      <div
        className={cn(
          'relative flex flex-col gap-6 py-8 md:flex-row md:items-stretch md:gap-10',
          flip && 'md:flex-row-reverse',
        )}
      >
        <div className={cn('flex-1', flip ? 'md:pl-8' : 'md:pr-8')}>
          <ForgePlate className="h-full p-6 md:p-8" glow="teal">
            <div
              className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md border"
              style={{
                borderColor: `color-mix(in oklab, ${accent} 40%, transparent)`,
                background: `color-mix(in oklab, ${accent} 10%, #08080f)`,
                color: accent,
                boxShadow: `0 0 28px color-mix(in oklab, ${accent} 22%, transparent)`,
              }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">
              Module {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">
              {title}
            </h3>
            <p className="mt-4 max-w-lg font-mono text-sm leading-relaxed text-ink-secondary">{desc}</p>
          </ForgePlate>
        </div>
        {children && (
          <div className="flex-1">
            <ForgePlate className="forge-lcd h-full min-h-[200px] p-5">{children}</ForgePlate>
          </div>
        )}
      </div>
    </ForgeReveal>
  );
}
