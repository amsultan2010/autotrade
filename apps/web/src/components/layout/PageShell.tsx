'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn('relative mx-auto w-full max-w-[1480px] px-4 pb-10 pt-6 md:px-8 md:pb-14 md:pt-8', className)}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      variants={reduce ? undefined : fadeUp}
      className={cn(
        'mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">Workspace</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          <span className="bg-gradient-to-r from-ink via-ink to-gold bg-clip-text text-transparent">
            {title}
          </span>
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary">{description}</p>
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
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? undefined : fadeUp}
      whileHover={reduce ? undefined : { y: -3, transition: { duration: 0.2 } }}
      className={cn('material-panel p-4', className)}
    >
      <span className="hud-corners" aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-semibold tabular-nums text-ink',
          trend === 'up' && 'text-positive',
          trend === 'down' && 'text-negative',
        )}
      >
        {value}
      </p>
      {hint && <div className="mt-1 text-xs text-ink-secondary">{hint}</div>}
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
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      variants={reduce ? undefined : fadeUp}
      className={cn('material-panel', className)}
      data-tour={dataTour}
      id={id}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="hud-corners" aria-hidden />
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          {title && (
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-gold-muted text-gold">
        ◈
      </div>
      <p className="font-display text-xl font-bold text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-ink-secondary">{description}</p>
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
      className={cn(
        'material-inset inline-flex p-1',
        size === 'sm' && 'text-xs',
      )}
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
            'rounded-md px-3 py-1.5 font-semibold transition-all motion-safe:duration-200',
            size === 'sm' && 'px-2 py-1',
            value === opt
              ? 'bg-gold-muted text-gold shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        variant === 'default' && 'border-gold/30 bg-gold-muted text-gold',
        variant === 'success' && 'border-positive/30 bg-positive-muted text-positive',
        variant === 'warning' && 'border-warning/30 bg-warning-muted text-warning',
        variant === 'danger' && 'border-negative/30 bg-negative-muted text-negative',
        variant === 'muted' && 'border-border bg-surface-overlay text-ink-secondary',
      )}
    >
      {pulse && <span className="live-dot" />}
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
      <table className="w-full min-w-[480px] border-collapse text-sm [&_th]:border-b [&_th]:border-border [&_th]:pb-2 [&_th]:text-left [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-ink-muted [&_tr:hover]:bg-surface-raised/60 [&_td]:py-3 [&_td]:border-b [&_td]:border-border/50">
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
        'material-inset flex items-start gap-3 px-4 py-3 text-sm',
        variant === 'info' && 'border-teal/20 text-ink-secondary',
        variant === 'warning' && 'text-ink-secondary',
        variant === 'error' && 'text-ink-secondary',
      )}
      role="alert"
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="material-button shrink-0 px-2 py-1 text-ink-muted hover:text-ink"
        >
          ×
        </button>
      )}
    </div>
  );
}
