import type { MutationCtx } from '../_generated/server';
import { DEFAULT_BOT_SETTINGS } from './defaultBotSettings';
import { ensureFounderSubscription } from './founderSubscription';

/** Ensure paper account, bot settings, and subscription exist for a clerk user. */
export async function ensureUserRecords(
  ctx: MutationCtx,
  clerkId: string,
  email: string,
): Promise<void> {
  const [paperAccount, botSettings, subscription] = await Promise.all([
    ctx.db.query('paperAccounts').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
    ctx.db.query('botSettings').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
    ctx.db.query('subscriptions').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
  ]);

  if (!paperAccount) {
    await ctx.db.insert('paperAccounts', { clerkId, balance: 100_000, equity: 100_000 });
  }

  if (!botSettings) {
    await ctx.db.insert('botSettings', { clerkId, ...DEFAULT_BOT_SETTINGS });
  }

  if (!subscription) {
    await ctx.db.insert('subscriptions', { clerkId, status: 'NONE' });
  }

  await ensureFounderSubscription(ctx, clerkId, email);
}
