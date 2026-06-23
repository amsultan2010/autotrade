'use node';

import { action, internalAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError, v } from 'convex/values';
import { AlpacaBroker } from '@autotrade/engine/public';
import { decryptBrokerSecret } from './lib/brokerCrypto';

async function syncAlpacaForClerk(ctx: ActionCtx, clerkId: string) {
  const cred = (await ctx.runQuery(internal.brokerCredential._getRaw, { clerkId })) as {
    encryptedKeyId: string;
    encryptedSecret: string;
    paper: boolean;
  } | null;

  if (!cred) {
    await ctx.runMutation(internal.brokerSync._deleteSnapshot, { clerkId });
    return { synced: false, error: 'No broker connected' };
  }

  try {
    const keyId = decryptBrokerSecret(cred.encryptedKeyId);
    const secret = decryptBrokerSecret(cred.encryptedSecret);
    const broker = new AlpacaBroker({ keyId, secret, paper: cred.paper });

    const [account, positions] = await Promise.all([
      broker.getAccount(),
      broker.getPositions(),
    ]);

    await ctx.runMutation(internal.brokerSync._upsertSnapshot, {
      clerkId,
      equity: account.equity,
      cash: account.cash,
      buyingPower: account.buyingPower,
      lastEquity: account.lastEquity,
      mode: broker.mode,
      positions,
      syncError: undefined,
    });

    return {
      synced: true,
      equity: account.equity,
      positionCount: positions.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alpaca sync failed';
    const existing = (await ctx.runQuery(internal.brokerSync._getSnapshot, { clerkId })) as {
      equity: number;
      cash: number;
      buyingPower: number;
      lastEquity?: number;
      mode: 'paper' | 'live';
      positions: Array<{
        symbol: string;
        qty: number;
        avgEntryPrice: number;
        side: 'LONG' | 'SHORT';
        currentPrice?: number;
        marketValue?: number;
        unrealizedPnl?: number;
        unrealizedPnlPct?: number;
      }>;
    } | null;

    if (existing) {
      await ctx.runMutation(internal.brokerSync._upsertSnapshot, {
        clerkId,
        equity: existing.equity,
        cash: existing.cash,
        buyingPower: existing.buyingPower,
        lastEquity: existing.lastEquity,
        mode: existing.mode,
        positions: existing.positions,
        syncError: message,
      });
    } else {
      await ctx.runMutation(internal.brokerSync._upsertSnapshot, {
        clerkId,
        equity: 0,
        cash: 0,
        buyingPower: 0,
        mode: cred.paper ? 'paper' : 'live',
        positions: [],
        syncError: message,
      });
    }
    return { synced: false, error: message };
  }
}

/** Scheduled after Alpaca connect — no user session required. */
export const _syncForClerk = internalAction({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await syncAlpacaForClerk(ctx, clerkId);
  },
});

/** Fetch live Alpaca account + positions and cache in Convex for reactive UI. */
export const sync = action({
  args: {},
  returns: v.object({
    synced: v.boolean(),
    equity: v.optional(v.number()),
    positionCount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Unauthenticated');
    return syncAlpacaForClerk(ctx, identity.subject);
  },
});
