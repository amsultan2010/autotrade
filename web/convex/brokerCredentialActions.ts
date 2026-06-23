'use node';

import { action } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError, v } from 'convex/values';
import { requireInternalSecret } from './lib/internalSecret';
import { hasLiveTradingAccess } from './lib/entitlements';
import { decryptBrokerSecret, encryptBrokerSecret } from './lib/brokerCrypto';
import { verifyAlpacaCredentials } from '@autotrade/engine/public';

/** Validate Alpaca keys with the live API, then store AES-256-GCM encrypted. */
export const connect = action({
  args: {
    keyId: v.string(),
    secret: v.string(),
    paper: v.boolean(),
  },
  handler: async (ctx, { keyId, secret, paper }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Unauthenticated');

    const trimmedKey = keyId.trim();
    const trimmedSecret = secret.trim();
    const check = await verifyAlpacaCredentials(trimmedKey, trimmedSecret, paper);
    if (!check.ok) throw new ConvexError(check.error ?? 'Invalid Alpaca keys');

    if (!paper) {
      const user = await ctx.runQuery(internal.users._getByClerkId, {
        clerkId: identity.subject,
      });
      if (!user) throw new ConvexError('User not found');
      const sub = await ctx.runQuery(internal.subscriptionInternal._getByClerkId, {
        clerkId: identity.subject,
      });
      if (!hasLiveTradingAccess(user.role, sub, user.email)) {
        throw new ConvexError('Live Alpaca keys require live trading access.');
      }
    }

    await ctx.runMutation(internal.brokerCredential._upsertCredential, {
      clerkId: identity.subject,
      encryptedKeyId: encryptBrokerSecret(trimmedKey),
      encryptedSecret: encryptBrokerSecret(trimmedSecret),
      paper,
    });

    // Prime the reactive dashboard snapshot immediately after connect.
    await ctx.scheduler.runAfter(0, internal.brokerSyncActions._syncForClerk, {
      clerkId: identity.subject,
    });

    return { connected: true, provider: 'alpaca', paper };
  },
});

/** Remove broker connection and reset bot to paper mode. */
export const disconnect = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Unauthenticated');
    await ctx.runMutation(internal.brokerCredential._deleteCredential, {
      clerkId: identity.subject,
    });
    await ctx.runMutation(internal.brokerSync._deleteSnapshot, {
      clerkId: identity.subject,
    });
    return { connected: false };
  },
});

/**
 * Decrypt and return broker keys — only called server-side by the bot engine.
 * Never expose the return value to the client.
 */
export const getDecryptedKeys = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Unauthenticated');

    const cred = (await ctx.runQuery(internal.brokerCredential._getRaw, {
      clerkId: identity.subject,
    })) as { encryptedKeyId: string; encryptedSecret: string; paper: boolean; provider: string } | null;
    if (!cred) return null;

    return {
      keyId: decryptBrokerSecret(cred.encryptedKeyId),
      secret: decryptBrokerSecret(cred.encryptedSecret),
      paper: cred.paper,
      provider: cred.provider,
    };
  },
});

/** Bot engine: decrypt broker keys after validating BOT_INTERNAL_SECRET. */
export const getDecryptedKeysInternal = action({
  args: {
    clerkId: v.string(),
    secret: v.string(),
  },
  returns: v.union(
    v.object({
      keyId: v.string(),
      secret: v.string(),
      paper: v.boolean(),
      provider: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, { clerkId, secret }) => {
    requireInternalSecret(secret);

    const cred = (await ctx.runQuery(internal.brokerCredential._getRaw, {
      clerkId,
    })) as {
      encryptedKeyId: string;
      encryptedSecret: string;
      paper: boolean;
      provider: string;
    } | null;
    if (!cred) return null;

    return {
      keyId: decryptBrokerSecret(cred.encryptedKeyId),
      secret: decryptBrokerSecret(cred.encryptedSecret),
      paper: cred.paper,
      provider: cred.provider,
    };
  },
});

/** Internal version — called by bot actions using a service clerkId. */
export const getDecryptedKeysForUser = action({
  args: { clerkId: v.string(), secret: v.string() },
  handler: async (ctx, { clerkId, secret }) => {
    requireInternalSecret(secret);
    const cred = (await ctx.runQuery(internal.brokerCredential._getRaw, { clerkId })) as { encryptedKeyId: string; encryptedSecret: string; paper: boolean; provider: string } | null;
    if (!cred) return null;
    return {
      keyId: decryptBrokerSecret(cred.encryptedKeyId),
      secret: decryptBrokerSecret(cred.encryptedSecret),
      paper: cred.paper,
      provider: cred.provider,
    };
  },
});
