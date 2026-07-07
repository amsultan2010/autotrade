
'use client';

import { SupabaseProvider } from '@/components/SupabaseProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <SupabaseProvider>{children}</SupabaseProvider>;
}
