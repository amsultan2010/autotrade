'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { forgeFadeUp } from '@/src/components/forge/ScrollEngine';

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('relative mx-auto w-full max-w-[1520px] px-3 pb-[calc(var(--mobile-nav-h)+16px)] pt-4 app-readable md:px-6 md:pb-8 md:pt-5', className)}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  code,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  code?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={false}
      variants={reduce ? undefined : forgeFadeUp}
      className={cn(
        'mb-6 flex flex-col gap-4 border-b border-border pb-5 md:mb-8 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-3">
          <span className="forge-led" aria-hidden />
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-teal">
            {code ?? 'SYS://CONSOLE'}
          </p>
        </div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary md:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  className,
  variant = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  variant?: 'default' | 'danger' | 'teal';
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={false}
      variants={reduce ? undefined : forgeFadeUp}
      whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.18 } }}
      className={cn(
        'forge-plate relative p-4',
        variant === 'danger' && 'border-red/20',
        variant === 'teal' && 'border-teal/25',
        className,
      )}
    >
      <span className="forge-bracket" aria-hidden />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-bold tabular-nums text-ink',
          trend === 'up' && 'text-positive',
          trend === 'down' && 'text-negative',
          variant === 'teal' && 'text-teal',
          variant === 'danger' && 'text-red',
        )}
      >
        {value}
      </p>
      {hint && <div className="mt-1.5 text-xs text-ink-secondary md:text-sm">{hint}</div>}
    </motion.div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  'data-tour': dataTour,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  id,
  dense,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  'data-tour'?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
  id?: string;
  dense?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={false}
      variants={reduce ? undefined : forgeFadeUp}
      className={cn(
        'forge-plate relative',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-teal/30 before:to-transparent',
        className,
      )}
      data-tour={dataTour}
      id={id}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="forge-bracket" aria-hidden />
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised/40 px-4 py-3 md:px-5">
          {title && (
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-teal md:text-base">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className={cn(dense ? 'p-3 md:p-4' : 'p-4 md:p-5')}>{children}</div>
    </motion.section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-teal/30 bg-teal-muted shadow-[var(--shadow-teal-glow)]">
        <span className="font-mono text-2xl text-teal">◈</span>
      </div>
      <p className="font-display text-xl font-bold uppercase tracking-wide text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'default';
}) {
  return (
    <div
      className={cn('forge-inset inline-flex gap-0.5 p-1 text-sm', size === 'sm' && 'text-xs')}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={value === opt}
          onClick={() => onChange(opt)}
          className={cn(
            'rounded px-3 py-1.5 font-mono font-bold uppercase tracking-wider transition-all motion-safe:duration-200',
            size === 'sm' && 'px-2 py-1',
            value === opt
              ? 'bg-teal-muted text-teal shadow-[inset_0_1px_0_rgb(0_255_208/0.12)]'
              : 'text-ink-muted hover:text-ink-secondary',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default',
  pulse,
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider',
        variant === 'default' && 'border-teal/30 bg-teal-muted text-teal',
        variant === 'success' && 'border-positive/30 bg-positive-muted text-positive',
        variant === 'warning' && 'border-warning/30 bg-warning-muted text-warning',
        variant === 'danger' && 'border-negative/30 bg-negative-muted text-negative',
        variant === 'muted' && 'border-border bg-surface-overlay text-ink-secondary',
      )}
    >
      {pulse && <span className="forge-led" />}
      {children}
    </span>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[480px] border-collapse text-sm [&_th]:border-b [&_th]:border-border [&_th]:pb-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-ink-muted [&_tr:hover]:bg-teal/[0.03] [&_td]:border-b [&_td]:border-border/40 [&_td]:py-3 [&_td]:text-ink">
        {children}
      </table>
    </div>
  );
}

export function AlertBanner({
  children,
  variant = 'info',
  onDismiss,
}: {
  children: ReactNode;
  variant?: 'info' | 'warning' | 'error';
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cn(
        'forge-inset flex items-start gap-3 px-4 py-3 text-sm leading-relaxed',
        variant === 'info' && 'border-teal/20 text-ink-secondary',
        variant === 'warning' && 'border-warning/20 text-ink-secondary',
        variant === 'error' && 'border-red/25 text-ink-secondary',
      )}
      role="alert"
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="forge-button shrink-0 px-2 py-1 text-ink-muted hover:text-ink"
        >
          ×
        </button>
      )}
    </div>
  );
}
