import { getMarketData, getQuoteForUser } from '@autotrade/engine/public';

/** Market data for an authenticated user — prefers their connected Alpaca keys. */
export async function marketDataForUser(clerkId: string) {
  try {
    const { getMarketDataForUser } = await import('@autotrade/engine/public');
    return await getMarketDataForUser(clerkId);
  } catch {
    return getMarketData();
  }
}

/** Quote for a user with fallback when personal Alpaca keys fail auth. */
export async function quoteForUser(clerkId: string, symbol: string) {
  return getQuoteForUser(clerkId, symbol);
}
