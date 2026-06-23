import { query, mutation, type QueryCtx } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { canUsePaperTrading, isLiveEntitled } from './lib/entitlements';
import { isBillingEnabled } from './lib/billing';
import { requireAuth } from './lib/adminAuth';
import { DEFAULT_BOT_SETTINGS } from './lib/defaultBotSettings';

async function getPaperEntitlement(ctx: QueryCtx, clerkId: string) {
  const [user, sub, trades] = await Promise.all([
    ctx.db.query('users').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
    ctx.db.query('subscriptions').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
    ctx.db.query('trades').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).collect(),
  ]);
  const role = user?.role ?? 'USER';
  const paperTradesUsed = trades.filter((t) => t.mode === 'PAPER').length;
  return {
    role,
    sub,
    paperTradesUsed,
    canUsePaperTrading: canUsePaperTrading(),
    entitled: isLiveEntitled(role, sub, user?.email),
  };
}

const modeValidator = v.union(v.literal('DISABLED'), v.literal('PAPER'), v.literal('LIVE'));
const riskLevelValidator = v.union(v.literal('LOW'), v.literal('MEDIUM'), v.literal('HIGH'));
const hhmm = v.string(); // validated as HH:MM

const botSettingsDocValidator = v.object({
  _id: v.id('botSettings'),
  _creationTime: v.number(),
  clerkId: v.string(),
  mode: modeValidator,
  riskLevel: riskLevelValidator,
  maxActiveTrades: v.number(),
  maxTradeSize: v.number(),
  riskPerTradePct: v.number(),
  defaultStopPct: v.number(),
  defaultTakeProfitPct: v.number(),
  maxDailyLoss: v.number(),
  tradingHoursStart: v.string(),
  tradingHoursEnd: v.string(),
  minConfidence: v.number(),
  timeframes: v.array(v.string()),
  strategies: v.array(v.string()),
});

/** Get bot settings for the current user. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query('botSettings')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

/** Update bot settings (partial update — only fields passed in are changed). */
export const update = mutation({
  args: {
    mode: v.optional(modeValidator),
    riskLevel: v.optional(riskLevelValidator),
    maxActiveTrades: v.optional(v.number()),
    maxTradeSize: v.optional(v.number()),
    riskPerTradePct: v.optional(v.number()),
    defaultStopPct: v.optional(v.number()),
    defaultTakeProfitPct: v.optional(v.number()),
    maxDailyLoss: v.optional(v.number()),
    tradingHoursStart: v.optional(hhmm),
    tradingHoursEnd: v.optional(hhmm),
    minConfidence: v.optional(v.number()),
    timeframes: v.optional(v.array(v.string())),
    strategies: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    const settings = await ctx.db
      .query('botSettings')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!settings) throw new ConvexError('Bot settings not found — user not fully initialised');

    // Strip undefined fields before patching.
    const patch = Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined),
    );

    await ctx.db.patch('botSettings', settings._id, patch);
    return ctx.db.get('botSettings', settings._id);
  },
});

/** Combined status query — bot settings + open trade count + paper account. */
export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkId = identity.subject;

    const [settings, paperAccount, openTrades, paperEntitlement] = await Promise.all([
      ctx.db
        .query('botSettings')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique(),
      ctx.db
        .query('paperAccounts')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique(),
      ctx.db
        .query('trades')
        .withIndex('by_clerk_result', (q) => q.eq('clerkId', clerkId).eq('result', 'OPEN'))
        .collect(),
      getPaperEntitlement(ctx, clerkId),
    ]);

    const mode = settings?.mode ?? 'DISABLED';
    return {
      mode,
      running: mode === 'PAPER' || mode === 'LIVE',
      openTrades: openTrades.length,
      paperAccount: paperAccount
        ? { balance: paperAccount.balance, equity: paperAccount.equity }
        : null,
      paperTradesUsed: paperEntitlement.paperTradesUsed,
      canUsePaperTrading: paperEntitlement.canUsePaperTrading,
      entitled: paperEntitlement.entitled,
    };
  },
});

/** Force-set bot mode (used by bot start/stop controls). */
export const setMode = mutation({
  args: { mode: modeValidator },
  returns: botSettingsDocValidator,
  handler: async (ctx, { mode }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    if (mode === 'LIVE') {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique();
      const isBypassRole = user?.role === 'ADMIN' || user?.role === 'DEVELOPER';

      if (!isBypassRole) {
        const sub = await ctx.db
          .query('subscriptions')
          .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
          .unique();
        if (!isLiveEntitled(user?.role ?? 'USER', sub, user?.email)) {
          throw new ConvexError(
            isBillingEnabled()
              ? 'Live trading requires an active subscription.'
              : 'Live trading is not available yet.',
          );
        }
      }

      const cred = await ctx.db
        .query('brokerCredentials')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique();
      if (!cred) throw new ConvexError('Connect a live Alpaca account before enabling LIVE mode');
      if (cred.paper) throw new ConvexError('Your Alpaca account is set to paper trading — connect a live Alpaca account to use LIVE mode');
    }

    let settings = await ctx.db
      .query('botSettings')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!settings) {
      const id = await ctx.db.insert('botSettings', { clerkId, ...DEFAULT_BOT_SETTINGS, mode });
      const created = await ctx.db.get('botSettings', id);
      if (!created) throw new ConvexError('Failed to create bot settings');
      return created;
    }

    await ctx.db.patch('botSettings', settings._id, { mode });
    const updated = await ctx.db.get('botSettings', settings._id);
    if (!updated) throw new ConvexError('Bot settings not found after update');
    return updated;
  },
});
