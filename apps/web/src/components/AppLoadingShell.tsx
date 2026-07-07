'use client';

import { ForgePlate } from '@/src/components/forge/ForgePrimitives';
import { Skeleton } from '@/src/components/Skeleton';

/** Shown while Clerk session loads — avoids a blank flash (Peak-End Rule). */
export function AppLoadingShell() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
      <ForgePlate className="w-full max-w-md p-8" glow="teal">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.png" alt="" width={36} height={36} className="rounded-md" />
          <div>
            <p className="font-display text-lg font-bold uppercase tracking-wide text-ink">Autotrade</p>
            <p className="text-sm text-ink-secondary">Loading your console…</p>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton height={12} width="100%" />
          <Skeleton height={12} width="88%" />
          <Skeleton height={12} width="72%" />
        </div>
      </ForgePlate>
    </div>
  );
}
