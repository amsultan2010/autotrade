import type { MutationCtx } from '../_generated/server';
import { DEFAULT_BOT_SETTINGS } from './defaultBotSettings';
import { ensureFounderSubscription } from './founderSubscription';

const DEFAULT_WATCHLIST: Array<{ symbol: string; exchange: string }> = [
  { symbol: 'AAPL', exchange: 'US' },
  { symbol: 'MSFT', exchange: 'US' },
  { symbol: 'NVDA', exchange: 'US' },
  { symbol: 'SPY', exchange: 'US' },
  { symbol: 'QQQ', exchange: 'US' },
  { symbol: 'BTC/USD', exchange: 'CRYPTO' },
];

async function seedDefaultWatchlist(ctx: MutationCtx, clerkId: string): Promise<void> {
  const existing = await ctx.db
    .query('watchedSymbols')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .first();
  if (existing) return;

  const now = Date.now();
  for (const item of DEFAULT_WATCHLIST) {
    await ctx.db.insert('watchedSymbols', {
      clerkId,
      symbol: item.symbol,
      exchange: item.exchange,
      addedAt: now,
    });
  }
}

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

  await seedDefaultWatchlist(ctx, clerkId);
  await ensureFounderSubscription(ctx, clerkId, email);
}
