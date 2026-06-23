'use node';
// All exports here are actions — Node.js runtime only supports actions.
// Queries and mutations live in botInternal.ts (V8 runtime).

import { internalAction, action } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError } from 'convex/values';

/** Trigger a single bot cycle for the current user on demand. */
export const runNow = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const botSecret = process.env.BOT_INTERNAL_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
    if (!botSecret || !appUrl) {
      throw new ConvexError(
        'Bot not configured — set BOT_INTERNAL_SECRET and NEXT_PUBLIC_APP_URL in the Convex dashboard',
      );
    }

    const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const res = await fetch(`${baseUrl}/api/internal/bot/run-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': botSecret },
      body: JSON.stringify({ clerkId: identity.subject }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError(`Bot run failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<{ signalsGenerated?: number; tradesOpened?: number }>;
  },
});

/**
 * Trigger a bot cycle for all active users.
 * Called by the cron every 5 minutes.
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

    const clerkIds = await ctx.runQuery(internal.botInternal._getActiveUserIds, {});
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

          await ctx.runMutation(internal.botInternal._logCycleResult, {
            clerkId,
            success: true,
            signalsGenerated: data.signalsGenerated,
            tradesOpened: data.tradesOpened,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[bot] cycle failed for ${clerkId}:`, msg);
          await ctx.runMutation(internal.botInternal._logCycleResult, {
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
