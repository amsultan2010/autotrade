/** Performance analytics — implemented in apps/web via Supabase queries. */
import type { PerformanceSummary } from '@autotrade/shared';

const message = 'Use Supabase performance queries from the web layer';

export async function computePerformance(_clerkId: string): Promise<PerformanceSummary> {
  throw new Error(message);
}

export async function computeBreakdowns(_clerkId: string): Promise<{
  byStrategy: Array<{ key: string; trades: number; wins: number; pnl: number }>;
  bySymbol: Array<{ key: string; trades: number; wins: number; pnl: number }>;
}> {
  throw new Error(message);
}
