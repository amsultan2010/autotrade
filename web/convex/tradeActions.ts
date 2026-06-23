'use node';
import { action } from './_generated/server';
import { api } from './_generated/api';
import { ConvexError, v } from 'convex/values';

/** Close an open trade at the current market price.
 * For broker-backed trades (paper or live), closes the Alpaca position before recording in Convex. */
export const closeAtMarket = action({
  args: { id: v.id('trades') },
  handler: async (ctx, { id }): Promise<unknown> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Unauthenticated');

    const trade = (await ctx.runQuery(api.trades.get, { id })) as {
      entryPrice: number;
      symbol: string;
      mode?: string;
      brokerOrderId?: string;
    } | null;
    if (!trade) throw new ConvexError('Trade not found');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
    const botSecret = process.env.BOT_INTERNAL_SECRET;
    const base = appUrl ? (appUrl.startsWith('http') ? appUrl : `https://${appUrl}`) : null;

    let exitPrice: number = trade.entryPrice;

    if (trade.brokerOrderId && base && botSecret) {
      // Close the Alpaca position and get the real fill price when available.
      try {
        const res = await fetch(`${base}/api/internal/broker/close-position`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': botSecret },
          body: JSON.stringify({ clerkId: identity.subject, symbol: trade.symbol }),
        });
        if (res.ok) {
          const data = (await res.json()) as { exitPrice?: number | null };
          if (data.exitPrice) exitPrice = data.exitPrice;
        }
      } catch { /* fall back to quote price */ }
    }

    // Fallback: get current quote price if we don't have a fill price yet.
    if (exitPrice === trade.entryPrice && base) {
      try {
        const res = await fetch(`${base}/api/v1/market/quote/${encodeURIComponent(trade.symbol)}`);
        if (res.ok) {
          const data = (await res.json()) as { price?: number };
          if (data.price) exitPrice = data.price;
        }
      } catch { /* fall back to entry price */ }
    }

    return ctx.runMutation(api.trades.close, { id, exitPrice, exitReason: 'Manual close' });
  },
});
