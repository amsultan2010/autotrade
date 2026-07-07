
'use client';

import { SupabaseProvider } from '@/components/SupabaseProvider';
import { SmoothScroll } from '@/src/components/forge/SmoothScroll';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <SupabaseProvider>{children}</SupabaseProvider>
    </SmoothScroll>
  );
}
