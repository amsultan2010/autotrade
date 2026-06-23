import { query, mutation, type QueryCtx } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import {
  FREE_PAPER_TRADE_LIMIT,
  canUsePaperTrading,
  isProEntitled,
} from '@autotrade/shared';

function requireAuth(identity: { subject: string } | null): string {
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}

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
    canUsePaperTrading: canUsePaperTrading(role, sub, paperTradesUsed),
    entitled: isProEntitled(role, sub),
  };
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

    if (!settings) throw new ConvexError('Bot settings not found — user not fully initialised');

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
      paperTradesLimit: FREE_PAPER_TRADE_LIMIT,
      canUsePaperTrading: paperEntitlement.canUsePaperTrading,
      entitled: paperEntitlement.entitled,
    };
  },
});

/** Force-set bot mode (used by bot start/stop controls). */
export const setMode = mutation({
  args: { mode: modeValidator },
  handler: async (ctx, { mode }) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = requireAuth(identity);

    if (mode === 'PAPER') {
      const ent = await getPaperEntitlement(ctx, clerkId);
      if (!ent.canUsePaperTrading) {
        throw new ConvexError(
          `Free paper trading limit reached (${FREE_PAPER_TRADE_LIMIT} trades). Upgrade to Pro to continue.`,
        );
      }
    }

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
        const entitled = sub?.status === 'ACTIVE' || sub?.status === 'TRIALING';
        if (!entitled) throw new ConvexError('Live trading requires a Pro subscription.');
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
      // Self-heal: create default settings if missing (e.g. webhook missed on sign-up).
      const id = await ctx.db.insert('botSettings', {
        clerkId,
        mode,
        riskLevel: 'MEDIUM',
        maxActiveTrades: 5,
        maxTradeSize: 10_000,
        riskPerTradePct: 1.0,
        defaultStopPct: 2.0,
        defaultTakeProfitPct: 4.0,
        maxDailyLoss: 2_000,
        tradingHoursStart: '09:30',
        tradingHoursEnd: '16:00',
        minConfidence: 60,
        timeframes: ['5m', '15m', '1h', '1d'],
        strategies: ['TrendBreakout', 'PullbackContinuation', 'MeanReversion', 'CryptoMomentum'],
      });
      return ctx.db.get(id);
    }

    await ctx.db.patch(settings._id, { mode });
    return ctx.db.get(settings._id);
  },
});
