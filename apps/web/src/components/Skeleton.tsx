import { cn } from '@/lib/utils';

export function Skeleton({
  className = '',
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <span
      className={cn(
        'inline-block animate-pulse rounded-md bg-surface-overlay motion-reduce:animate-none',
        className,
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton height={14} width="22%" />
          <Skeleton height={14} width="18%" />
          <Skeleton height={14} width="16%" />
          <Skeleton height={14} width="14%" />
        </div>
      ))}
    </div>
  );
}
