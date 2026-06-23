// Queries and internal mutations only — NO 'use node'.
// Encryption/decryption lives in brokerCredentialActions.ts (Node.js runtime).
import { query, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

// ── Internal mutations (called only from brokerCredentialActions) ─────────────

export const _upsertCredential = internalMutation({
  args: {
    clerkId: v.string(),
    encryptedKeyId: v.string(),
    encryptedSecret: v.string(),
    paper: v.boolean(),
  },
  handler: async (ctx, { clerkId, encryptedKeyId, encryptedSecret, paper }) => {
    const existing = await ctx.db
      .query('brokerCredentials')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { encryptedKeyId, encryptedSecret, paper });
    } else {
      await ctx.db.insert('brokerCredentials', {
        clerkId,
        provider: 'alpaca',
        encryptedKeyId,
        encryptedSecret,
        paper,
      });
    }

    // Switching to paper? Downgrade live bot mode automatically.
    if (paper) {
      const settings = await ctx.db
        .query('botSettings')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique();
      if (settings && settings.mode === 'LIVE') {
        await ctx.db.patch(settings._id, { mode: 'PAPER' });
      }
    }
  },
});

export const _deleteCredential = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const cred = await ctx.db
      .query('brokerCredentials')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (cred) await ctx.db.delete(cred._id);

    const settings = await ctx.db
      .query('botSettings')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (settings) await ctx.db.patch(settings._id, { mode: 'PAPER' });
  },
});

// Internal read — used by getDecryptedKeys action.
export const _getRaw = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return ctx.db
      .query('brokerCredentials')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
  },
});

// ── Public queries ────────────────────────────────────────────────────────────

/** Broker connection status — never exposes raw keys. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { connected: false };
    const cred = await ctx.db
      .query('brokerCredentials')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    if (!cred) return { connected: false };
    return { connected: true, provider: cred.provider, paper: cred.paper };
  },
});
