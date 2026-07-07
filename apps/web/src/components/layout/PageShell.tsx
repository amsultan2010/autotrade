import { cn } from '@/lib/utils';

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1440px] px-4 pb-8 pt-6 md:px-8 md:pb-12 md:pt-8', className)}>
      {children}
    </div>
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
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
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
  value: React.ReactNode;
  hint?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
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
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  ...rest
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
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
        'inline-flex rounded-lg border border-border bg-surface p-1',
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
            'rounded-md px-3 py-1.5 font-medium transition-colors motion-safe:duration-200',
            size === 'sm' && 'px-2 py-1',
            value === opt
              ? 'bg-accent-muted text-accent shadow-sm'
              : 'text-ink-secondary hover:text-ink',
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
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variant === 'default' && 'bg-accent-muted text-accent',
        variant === 'success' && 'bg-positive-muted text-positive',
        variant === 'warning' && 'bg-warning-muted text-warning',
        variant === 'danger' && 'bg-negative-muted text-negative',
        variant === 'muted' && 'bg-surface-overlay text-ink-secondary',
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
        </span>
      )}
      {children}
    </span>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[480px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function AlertBanner({
  children,
  variant = 'info',
  onDismiss,
}: {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'error';
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        variant === 'info' && 'border-accent/30 bg-accent-muted text-ink-secondary',
        variant === 'warning' && 'border-warning/30 bg-warning-muted text-ink-secondary',
        variant === 'error' && 'border-negative/30 bg-negative-muted text-ink-secondary',
      )}
      role="alert"
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          ×
        </button>
      )}
    </div>
  );
}
