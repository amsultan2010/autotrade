'use node';
// Bot engine scheduled action.
// Reads active users + their state from Convex, then calls the Next.js bot
// engine via an internal API endpoint protected by BOT_INTERNAL_SECRET.
// The Next.js engine owns the heavy trading logic (analysis, decision, risk)
// and writes results back to Convex via the server-side Convex client.

import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Fetch all clerkIds of users with an active/non-disabled bot. */
export const _getActiveUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query('botSettings')
      .filter((q) => q.neq(q.field('mode'), 'DISABLED'))
      .collect();

    // Cross-check with user status.
    const results: string[] = [];
    for (const s of settings) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', s.clerkId))
        .unique();
      if (user && user.status === 'ACTIVE') {
        results.push(s.clerkId);
      }
    }
    return results;
  },
});

/** Log a bot cycle result for observability. */
export const _logCycleResult = internalMutation({
  args: {
    clerkId: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    signalsGenerated: v.optional(v.number()),
    tradesOpened: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditLogs', {
      actorClerkId: args.clerkId,
      action: 'bot_cycle',
      meta: {
        success: args.success,
        error: args.error,
        signalsGenerated: args.signalsGenerated,
        tradesOpened: args.tradesOpened,
      },
      createdAt: Date.now(),
    });
  },
});

// ── Scheduled actions ─────────────────────────────────────────────────────────

/**
 * Trigger a bot cycle for all active users.
 * Called by the cron every 5 minutes (market hours only check happens inside
 * the Next.js engine — crypto runs 24/7, stocks only during market hours).
 */
export const runAllUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const botSecret = process.env.BOT_INTERNAL_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;

    if (!botSecret || !appUrl) {
      console.error('BOT_INTERNAL_SECRET or app URL not set — skipping bot cycle');
      return;
    }

    const clerkIds = await ctx.runQuery(internal.bot._getActiveUserIds, {});
    console.log(`[bot] Running cycle for ${clerkIds.length} active user(s)`);

    const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;

    await Promise.allSettled(
      clerkIds.map(async (clerkId: string) => {
        try {
          const res = await fetch(`${baseUrl}/api/internal/bot/run-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': botSecret,
            },
            body: JSON.stringify({ clerkId }),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
          }

          const data = (await res.json()) as {
            signalsGenerated?: number;
            tradesOpened?: number;
          };

          await ctx.runMutation(internal.bot._logCycleResult, {
            clerkId,
            success: true,
            signalsGenerated: data.signalsGenerated,
            tradesOpened: data.tradesOpened,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[bot] cycle failed for ${clerkId}:`, msg);
          await ctx.runMutation(internal.bot._logCycleResult, {
            clerkId,
            success: false,
            error: msg,
          });
        }
      }),
    );
  },
});

/**
 * Trigger the weekly digest emails for all subscribed users.
 * Called by the cron every Monday at 8am UTC.
 */
export const sendWeeklyDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const botSecret = process.env.BOT_INTERNAL_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;

    if (!botSecret || !appUrl) {
      console.error('Missing env vars for weekly digest');
      return;
    }

    const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;

    const res = await fetch(`${baseUrl}/api/email/weekly-digest`, {
      method: 'POST',
      headers: { 'x-internal-secret': botSecret },
    });

    if (!res.ok) {
      console.error(`[digest] weekly digest trigger failed: HTTP ${res.status}`);
    } else {
      console.log('[digest] weekly digest triggered successfully');
    }
  },
});
