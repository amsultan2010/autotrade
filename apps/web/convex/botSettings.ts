import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

function requireAuth(identity: { subject: string } | null): string {
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}

const modeValidator = v.union(v.literal('DISABLED'), v.literal('PAPER'), v.literal('LIVE'));
const riskLevelValidator = v.union(v.literal('LOW'), v.literal('MEDIUM'), v.literal('HIGH'));
const hhmm = v.string(); // validated as HH:MM

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

    if (!settings) throw new Error('Bot settings not found — user not fully initialised');

    // Strip undefined fields before patching.
    const patch = Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined),
    );

    await ctx.db.patch(settings._id, patch);
    return ctx.db.get(settings._id);
  },
});

/** Combined status query — bot settings + open trade count + paper account. */
export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkId = identity.subject;

    const [settings, paperAccount, openTrades] = await Promise.all([
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
    ]);

    const mode = settings?.mode ?? 'DISABLED';
    return {
      mode,
      running: mode === 'PAPER' || mode === 'LIVE',
      openTrades: openTrades.length,
      paperAccount: paperAccount
        ? { balance: paperAccount.balance, equity: paperAccount.equity }
        : null,
    };
  },
});

/** Force-set bot mode (used by bot start/stop controls). */
export const setMode = mutation({
  args: { mode: modeValidator },
  handler: async (ctx, { mode }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    if (mode === 'LIVE') {
      const cred = await ctx.db
        .query('brokerCredentials')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique();
      if (!cred) throw new Error('Connect a live Alpaca account before enabling LIVE mode');
      if (cred.paper) throw new Error('Your Alpaca account is set to paper trading — connect with live trading to use LIVE mode');
    }

    const settings = await ctx.db
      .query('botSettings')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!settings) throw new Error('Bot settings not found');
    await ctx.db.patch(settings._id, { mode });
    return ctx.db.get(settings._id);
  },
});
