'use node';
import { action } from './_generated/server';
import { api } from './_generated/api';
import { v } from 'convex/values';

/** Close an open trade at the current market price (fetched from the Next.js API). */
export const closeAtMarket = action({
  args: { id: v.id('trades') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const trade = await ctx.runQuery(api.trades.get, { id });
    if (!trade) throw new Error('Trade not found');

    let exitPrice = trade.entryPrice;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
    if (appUrl) {
      const base = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
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
