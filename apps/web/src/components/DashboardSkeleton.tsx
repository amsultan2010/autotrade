'use client';

import { Skeleton } from '@/src/components/Skeleton';
import { Panel } from '@/src/components/layout/PageShell';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" role="status">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="forge-plate p-4">
            <Skeleton height={10} width="40%" />
            <Skeleton className="mt-3" height={28} width="55%" />
          </div>
        ))}
      </div>
      <Panel title="Portfolio">
        <Skeleton height={220} width="100%" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Signals">
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={48} width="100%" />
            ))}
          </div>
        </Panel>
        <Panel title="Positions">
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={40} width="100%" />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
