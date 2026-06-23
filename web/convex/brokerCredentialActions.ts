'use node';
// All exports in this file run in the Node.js runtime.
// crypto requires Node.js — queries/mutations are in brokerCredential.ts.

import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import crypto from 'node:crypto';
import { requireInternalSecret } from './lib/internalSecret';
import { hasLiveTradingAccess } from './lib/entitlements';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.BROKER_ENCRYPTION_KEY;
  if (!raw) throw new Error('BROKER_ENCRYPTION_KEY is not set in Convex environment variables');
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return Buffer.from(raw, 'base64');
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decrypt(stored: string): string {
  const key = getKey();
  const [ivB64, tagB64, cipherB64] = stored.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

async function verifyAlpacaKeys(
  keyId: string,
  secret: string,
  paper: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const base = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  try {
    const res = await fetch(`${base}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secret,
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid API keys' };
    if (!res.ok) return { ok: false, error: `Alpaca returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach Alpaca — check your internet connection' };
  }
}

/** Validate Alpaca keys with the live API, then store AES-256-GCM encrypted. */
export const connect = action({
  args: {
    keyId: v.string(),
    secret: v.string(),
    paper: v.boolean(),
  },
  handler: async (ctx, { keyId, secret, paper }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const check = await verifyAlpacaKeys(keyId, secret, paper);
    if (!check.ok) throw new Error(check.error ?? 'Invalid Alpaca keys');

    if (!paper) {
      const user = await ctx.runQuery(internal.users._getByClerkId, {
        clerkId: identity.subject,
      });
      if (!user) throw new Error('User not found');
      const sub = await ctx.runQuery(internal.subscriptionInternal._getByClerkId, {
        clerkId: identity.subject,
      });
      if (!hasLiveTradingAccess(user.role, sub, user.email)) {
        throw new Error('Live Alpaca keys require live trading access.');
      }
    }

    await ctx.runMutation(internal.brokerCredential._upsertCredential, {
      clerkId: identity.subject,
      encryptedKeyId: encrypt(keyId),
      encryptedSecret: encrypt(secret),
      paper,
    });

    return { connected: true, provider: 'alpaca', paper };
  },
});

/** Remove broker connection and reset bot to paper mode. */
export const disconnect = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');
    await ctx.runMutation(internal.brokerCredential._deleteCredential, {
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
    if (!identity) throw new Error('Unauthenticated');

    const cred = (await ctx.runQuery(internal.brokerCredential._getRaw, {
      clerkId: identity.subject,
    })) as { encryptedKeyId: string; encryptedSecret: string; paper: boolean; provider: string } | null;
    if (!cred) return null;

    return {
      keyId: decrypt(cred.encryptedKeyId),
      secret: decrypt(cred.encryptedSecret),
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
      keyId: decrypt(cred.encryptedKeyId),
      secret: decrypt(cred.encryptedSecret),
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
      keyId: decrypt(cred.encryptedKeyId),
      secret: decrypt(cred.encryptedSecret),
      paper: cred.paper,
      provider: cred.provider,
    };
  },
});
