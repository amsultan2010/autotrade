import { getMarketData, getMarketDataForUser } from '@autotrade/engine/public';

/** Market data for an authenticated user — prefers their connected Alpaca keys. */
export async function marketDataForUser(clerkId: string) {
  try {
    return await getMarketDataForUser(clerkId);
  } catch {
    return getMarketData();
  }
}
