/**
 * Secret-guarded queries and mutations for the bot engine.
 * Auth: BOT_INTERNAL_SECRET env var (same trust model as bot cron / internal routes).
 */
import { query, mutation } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { isLiveEntitled } from './lib/entitlements';

const STOCK_AGG = '__STOCK__';
const CRYPTO_AGG = '__CRYPTO__';

function verifyBotSecret(secret: string): void {
  const expected = process.env.BOT_INTERNAL_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError('Unauthorized');
  }
}

const modeValidator = v.union(
  v.literal('DISABLED'),
  v.literal('PAPER'),
  v.literal('LIVE'),
);
const riskLevelValidator = v.union(v.literal('LOW'), v.literal('MEDIUM'), v.literal('HIGH'));
const tradeResultValidator = v.union(
  v.literal('OPEN'),
  v.literal('WIN'),
  v.literal('LOSS'),
  v.literal('BREAKEVEN'),
);
const sideValidator = v.union(v.literal('LONG'), v.literal('SHORT'));
const signalActionValidator = v.union(
  v.literal('BUY'),
  v.literal('SELL'),
  v.literal('HOLD'),
  v.literal('AVOID'),
  v.literal('CLOSE'),
);
const userRoleValidator = v.union(v.literal('USER'), v.literal('ADMIN'), v.literal('DEVELOPER'));
const userStatusValidator = v.union(v.literal('ACTIVE'), v.literal('DISABLED'));
const subscriptionStatusValidator = v.union(
  v.literal('NONE'),
  v.literal('ACTIVE'),
  v.literal('PAST_DUE'),
  v.literal('CANCELED'),
  v.literal('TRIALING'),
);
const assetClassValidator = v.union(v.literal('stock'), v.literal('crypto'));

const botSettingsValidator = v.object({
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
  stockStrategies: v.optional(v.array(v.string())),
  cryptoStrategies: v.optional(v.array(v.string())),
  includeExperimental: v.optional(v.boolean()),
  disabledStrategies: v.optional(v.array(v.string())),
});

const watchlistItemValidator = v.object({
  symbol: v.string(),
  exchange: v.string(),
  mic: v.optional(v.string()),
});

const tradeDocValidator = v.object({
  _id: v.id('trades'),
  _creationTime: v.number(),
  clerkId: v.string(),
  signalId: v.optional(v.id('signals')),
  symbol: v.string(),
  exchange: v.string(),
  side: sideValidator,
  mode: modeValidator,
  qty: v.number(),
  entryPrice: v.number(),
  exitPrice: v.optional(v.number()),
  stopLoss: v.optional(v.number()),
  takeProfit: v.optional(v.number()),
  pnl: v.optional(v.number()),
  result: tradeResultValidator,
  strategy: v.string(),
  confidence: v.number(),
  entryReason: v.string(),
  exitReason: v.optional(v.string()),
  mistakeTags: v.array(v.string()),
  entrySnapshot: v.optional(v.any()),
  exitSnapshot: v.optional(v.any()),
  reasoningCorrect: v.optional(v.boolean()),
  brokerOrderId: v.optional(v.string()),
  openedAt: v.number(),
  closedAt: v.optional(v.number()),
});

const botContextReturn = v.union(
  v.object({
    role: userRoleValidator,
    status: userStatusValidator,
    botSettings: v.union(botSettingsValidator, v.null()),
    watchlist: v.array(watchlistItemValidator),
    paperAccount: v.union(
      v.object({ balance: v.number(), equity: v.number() }),
      v.null(),
    ),
    subscription: v.union(
      v.object({
        status: subscriptionStatusValidator,
        tier: v.optional(v.string()),
        currentPeriodEnd: v.optional(v.number()),
      }),
      v.null(),
    ),
    liveEntitled: v.boolean(),
  }),
  v.null(),
);

/** Load user role, settings, watchlist, paper account, and subscription for the engine. */
export const getBotContext = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
  },
  returns: botContextReturn,
  handler: async (ctx, { secret, clerkId }) => {
    verifyBotSecret(secret);

    const [user, settings, watched, paperAccount, sub] = await Promise.all([
      ctx.db.query('users').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
      ctx.db.query('botSettings').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
      ctx.db.query('watchedSymbols').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).collect(),
      ctx.db.query('paperAccounts').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
      ctx.db.query('subscriptions').withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId)).unique(),
    ]);

    if (!user) return null;

    const role = user.role;
    const liveEntitled = isLiveEntitled(role, sub, user.email);

    return {
      role,
      status: user.status,
      botSettings: settings ?? null,
      watchlist: watched.map((w) => ({
        symbol: w.symbol,
        exchange: w.exchange,
        mic: w.mic,
      })),
      paperAccount: paperAccount
        ? { balance: paperAccount.balance, equity: paperAccount.equity }
        : null,
      subscription: sub
        ? { status: sub.status, tier: sub.tier, currentPeriodEnd: sub.currentPeriodEnd }
        : null,
      liveEntitled,
    };
  },
});

/** Count open trades for a user, optionally filtered by mode. */
export const countOpenTrades = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    mode: v.optional(modeValidator),
  },
  returns: v.number(),
  handler: async (ctx, { secret, clerkId, mode }) => {
    verifyBotSecret(secret);

    const open = await ctx.db
      .query('trades')
      .withIndex('by_clerk_result', (q) => q.eq('clerkId', clerkId).eq('result', 'OPEN'))
      .collect();

    if (!mode) return open.length;
    return open.filter((t) => t.mode === mode).length;
  },
});

/** Count all paper trades (open + closed) for entitlement checks. */
export const countPaperTrades = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, { secret, clerkId }) => {
    verifyBotSecret(secret);

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    return trades.filter((t) => t.mode === 'PAPER').length;
  },
});

/** Sum realized P/L for trades closed on or after dayStartMs (UTC day boundary from caller). */
export const realizedPnlToday = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    dayStartMs: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, { secret, clerkId, dayStartMs }) => {
    verifyBotSecret(secret);

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    let sum = 0;
    for (const t of trades) {
      if (t.result === 'OPEN' || t.closedAt == null || t.closedAt < dayStartMs) continue;
      sum += t.pnl ?? 0;
    }
    return Math.round(sum * 100) / 100;
  },
});

/** Find a single open trade by symbol and mode. */
export const findOpenTradeBySymbol = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    symbol: v.string(),
    mode: modeValidator,
  },
  returns: v.union(tradeDocValidator, v.null()),
  handler: async (ctx, { secret, clerkId, symbol, mode }) => {
    verifyBotSecret(secret);

    const sym = symbol.toUpperCase();
    const open = await ctx.db
      .query('trades')
      .withIndex('by_clerk_result', (q) => q.eq('clerkId', clerkId).eq('result', 'OPEN'))
      .collect();

    return open.find((t) => t.symbol === sym && t.mode === mode) ?? null;
  },
});

/** List open trades, optionally filtered by mode. */
export const getOpenTrades = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    mode: v.optional(modeValidator),
  },
  returns: v.array(tradeDocValidator),
  handler: async (ctx, { secret, clerkId, mode }) => {
    verifyBotSecret(secret);

    const open = await ctx.db
      .query('trades')
      .withIndex('by_clerk_result', (q) => q.eq('clerkId', clerkId).eq('result', 'OPEN'))
      .collect();

    if (!mode) return open;
    return open.filter((t) => t.mode === mode);
  },
});

/** Open PAPER trades on a symbol (for stream engine close path). */
export const getOpenTradesBySymbol = query({
  args: {
    secret: v.string(),
    symbol: v.string(),
  },
  returns: v.array(tradeDocValidator),
  handler: async (ctx, { secret, symbol }) => {
    verifyBotSecret(secret);

    const sym = symbol.toUpperCase();
    const bySymbol = await ctx.db
      .query('trades')
      .withIndex('by_symbol', (q) => q.eq('symbol', sym))
      .collect();

    return bySymbol.filter((t) => t.mode === 'PAPER' && t.result === 'OPEN');
  },
});

/** Count signals created at or after sinceMs for a user. */
export const countSignalsSince = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    sinceMs: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, { secret, clerkId, sinceMs }) => {
    verifyBotSecret(secret);

    const signals = await ctx.db
      .query('signals')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    return signals.filter((s) => s.createdAt >= sinceMs).length;
  },
});


/** Count trades opened at or after sinceMs for a user. */
export const countTradesOpenedSince = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    sinceMs: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, { secret, clerkId, sinceMs }) => {
    verifyBotSecret(secret);

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    return trades.filter((t) => t.openedAt >= sinceMs).length;
  },
});

/** Active users for cron jobs (weekly digest). */
export const listActiveUsers = query({
  args: { secret: v.string() },
  returns: v.array(v.object({ clerkId: v.string(), email: v.string() })),
  handler: async (ctx, { secret }) => {
    verifyBotSecret(secret);

    const users = await ctx.db.query('users').collect();
    return users
      .filter((u) => u.status === 'ACTIVE')
      .map((u) => ({ clerkId: u.clerkId, email: u.email }));
  },
});

const digestTradeResult = v.union(
  v.literal('WIN'),
  v.literal('LOSS'),
  v.literal('BREAKEVEN'),
);

/** Closed trades since sinceMs for weekly digest email. */
export const getDigestTrades = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    sinceMs: v.number(),
  },
  returns: v.array(
    v.object({
      symbol: v.string(),
      pnl: v.optional(v.number()),
      result: digestTradeResult,
    }),
  ),
  handler: async (ctx, { secret, clerkId, sinceMs }) => {
    verifyBotSecret(secret);

    const trades = await ctx.db
      .query('trades')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    return trades
      .filter(
        (t) =>
          t.result !== 'OPEN' &&
          t.closedAt != null &&
          t.closedAt >= sinceMs,
      )
      .map((t) => ({
        symbol: t.symbol,
        pnl: t.pnl,
        result: t.result as 'WIN' | 'LOSS' | 'BREAKEVEN',
      }));
  },
});

/** Learned strategy weights for an asset class (__STOCK__ / __CRYPTO__ aggregate rows). */
export const getStrategyWeights = query({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    assetClass: assetClassValidator,
  },
  returns: v.record(v.string(), v.number()),
  handler: async (ctx, { secret, clerkId, assetClass }) => {
    verifyBotSecret(secret);

    const key = assetClass === 'crypto' ? CRYPTO_AGG : STOCK_AGG;
    const rows = await ctx.db
      .query('strategyStats')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .collect();

    const out: Record<string, number> = {};
    for (const row of rows) {
      if (row.symbol === key) out[row.strategy] = row.weightedConfidence;
    }
    return out;
  },
});

/** Record a signal emitted by the engine. */
export const createSignal = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    ticker: v.string(),
    exchange: v.string(),
    price: v.number(),
    timeframe: v.string(),
    strategy: v.string(),
    action: signalActionValidator,
    confidence: v.number(),
    riskLevel: riskLevelValidator,
    entryReason: v.string(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    rrRatio: v.optional(v.number()),
    explanation: v.string(),
    createdAt: v.optional(v.number()),
  },
  returns: v.id('signals'),
  handler: async (ctx, args) => {
    verifyBotSecret(args.secret);

    return ctx.db.insert('signals', {
      clerkId: args.clerkId,
      ticker: args.ticker,
      exchange: args.exchange,
      price: args.price,
      timeframe: args.timeframe,
      strategy: args.strategy,
      action: args.action,
      confidence: args.confidence,
      riskLevel: args.riskLevel,
      entryReason: args.entryReason,
      stopLoss: args.stopLoss,
      takeProfit: args.takeProfit,
      rrRatio: args.rrRatio,
      explanation: args.explanation,
      createdAt: args.createdAt ?? Date.now(),
    });
  },
});

/** Open a paper or live trade from the engine. */
export const createTrade = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    signalId: v.optional(v.id('signals')),
    symbol: v.string(),
    exchange: v.string(),
    side: sideValidator,
    mode: v.union(v.literal('PAPER'), v.literal('LIVE')),
    qty: v.number(),
    entryPrice: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    strategy: v.string(),
    confidence: v.number(),
    entryReason: v.string(),
    entrySnapshot: v.optional(v.any()),
    brokerOrderId: v.optional(v.string()),
    openedAt: v.optional(v.number()),
  },
  returns: v.id('trades'),
  handler: async (ctx, args) => {
    verifyBotSecret(args.secret);

    if (args.mode === 'LIVE') {
      const [user, sub] = await Promise.all([
        ctx.db.query('users').withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId)).unique(),
        ctx.db.query('subscriptions').withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId)).unique(),
      ]);
      if (!isLiveEntitled(user?.role ?? 'USER', sub, user?.email)) {
        throw new ConvexError('Live trading is not permitted for this account.');
      }
    }

    return ctx.db.insert('trades', {
      clerkId: args.clerkId,
      signalId: args.signalId,
      symbol: args.symbol.toUpperCase(),
      exchange: args.exchange,
      side: args.side,
      mode: args.mode,
      qty: args.qty,
      entryPrice: args.entryPrice,
      stopLoss: args.stopLoss,
      takeProfit: args.takeProfit,
      strategy: args.strategy,
      confidence: args.confidence,
      entryReason: args.entryReason,
      entrySnapshot: args.entrySnapshot,
      brokerOrderId: args.brokerOrderId,
      result: 'OPEN',
      mistakeTags: [],
      openedAt: args.openedAt ?? Date.now(),
    });
  },
});

/** Close an open trade and compute P/L and result. */
export const closeTrade = mutation({
  args: {
    secret: v.string(),
    tradeId: v.id('trades'),
    exitPrice: v.number(),
    exitReason: v.optional(v.string()),
    mistakeTags: v.optional(v.array(v.string())),
    reasoningCorrect: v.optional(v.boolean()),
    exitSnapshot: v.optional(v.any()),
  },
  returns: v.object({
    pnl: v.number(),
    result: v.union(v.literal('WIN'), v.literal('LOSS'), v.literal('BREAKEVEN')),
  }),
  handler: async (ctx, { secret, tradeId, exitPrice, exitReason, mistakeTags, reasoningCorrect, exitSnapshot }) => {
    verifyBotSecret(secret);

    const trade = await ctx.db.get(tradeId);
    if (!trade) throw new ConvexError('Trade not found');
    if (trade.result !== 'OPEN') throw new ConvexError('Trade is already closed');

    const rawPnl =
      trade.side === 'LONG'
        ? (exitPrice - trade.entryPrice) * trade.qty
        : (trade.entryPrice - exitPrice) * trade.qty;
    const pnl = Math.round(rawPnl * 100) / 100;

    let result: 'WIN' | 'LOSS' | 'BREAKEVEN';
    if (pnl > 0) result = 'WIN';
    else if (pnl < 0) result = 'LOSS';
    else result = 'BREAKEVEN';

    await ctx.db.patch(tradeId, {
      exitPrice,
      pnl,
      result,
      exitReason,
      mistakeTags: mistakeTags ?? [],
      reasoningCorrect,
      exitSnapshot,
      closedAt: Date.now(),
    });

    return { pnl, result };
  },
});

/** Increment paper account balance and equity. */
export const adjustPaperAccount = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    balanceDelta: v.number(),
    equityDelta: v.number(),
  },
  returns: v.union(
    v.object({ balance: v.number(), equity: v.number() }),
    v.null(),
  ),
  handler: async (ctx, { secret, clerkId, balanceDelta, equityDelta }) => {
    verifyBotSecret(secret);

    const account = await ctx.db
      .query('paperAccounts')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!account) return null;

    const balance = account.balance + balanceDelta;
    const equity = account.equity + equityDelta;
    await ctx.db.patch(account._id, { balance, equity });
    return { balance, equity };
  },
});

/** Set paper account equity to an absolute value (mark-to-market). */
export const setPaperEquity = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    equity: v.number(),
  },
  returns: v.union(
    v.object({ balance: v.number(), equity: v.number() }),
    v.null(),
  ),
  handler: async (ctx, { secret, clerkId, equity }) => {
    verifyBotSecret(secret);

    const account = await ctx.db
      .query('paperAccounts')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (!account) return null;

    await ctx.db.patch(account._id, { equity });
    return { balance: account.balance, equity };
  },
});

/** Upsert strategy stats after a closed trade (engine path). */
export const recordStrategyOutcome = mutation({
  args: {
    secret: v.string(),
    clerkId: v.string(),
    strategy: v.string(),
    symbol: v.string(),
    won: v.boolean(),
    pnl: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { secret, clerkId, strategy, symbol, won, pnl }) => {
    verifyBotSecret(secret);

    const existing = await ctx.db
      .query('strategyStats')
      .withIndex('by_clerk_strategy_symbol', (q) =>
        q.eq('clerkId', clerkId).eq('strategy', strategy).eq('symbol', symbol),
      )
      .unique();

    if (existing) {
      const trades = existing.trades + 1;
      const wins = existing.wins + (won ? 1 : 0);
      const losses = existing.losses + (won ? 0 : 1);
      const totalPnl = existing.totalPnl + pnl;
      const expectancy = totalPnl / trades;
      const winRate = wins / trades;
      const raw = 0.5 + winRate;
      const weightedConfidence = Math.max(0.5, Math.min(1.5, raw));

      await ctx.db.patch(existing._id, {
        trades,
        wins,
        losses,
        totalPnl,
        expectancy,
        weightedConfidence,
      });
    } else {
      await ctx.db.insert('strategyStats', {
        clerkId,
        strategy,
        symbol,
        trades: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        totalPnl: pnl,
        expectancy: pnl,
        weightedConfidence: 1.0,
      });
    }

    return null;
  },
});

/** Active bot users and their watched symbols (for live engine subscriptions). */
export const getActiveBotUsers = query({
  args: { secret: v.string() },
  returns: v.array(
    v.object({
      clerkId: v.string(),
      symbols: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { secret }) => {
    verifyBotSecret(secret);

    const users = await ctx.db.query('users').collect();
    const out: Array<{ clerkId: string; symbols: string[] }> = [];

    for (const user of users) {
      if (user.status !== 'ACTIVE') continue;
      const settings = await ctx.db
        .query('botSettings')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', user.clerkId))
        .unique();
      if (!settings || settings.mode === 'DISABLED') continue;

      const watched = await ctx.db
        .query('watchedSymbols')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', user.clerkId))
        .collect();

      out.push({
        clerkId: user.clerkId,
        symbols: watched.map((w) => w.symbol.toUpperCase()),
      });
    }

    return out;
  },
});

/** Append an audit log entry from the engine. */
export const writeAuditLog = mutation({
  args: {
    secret: v.string(),
    actorClerkId: v.optional(v.string()),
    action: v.string(),
    target: v.optional(v.string()),
    meta: v.optional(v.any()),
    ip: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { secret, actorClerkId, action, target, meta, ip }) => {
    verifyBotSecret(secret);

    await ctx.db.insert('auditLogs', {
      actorClerkId,
      action,
      target,
      meta,
      ip,
      createdAt: Date.now(),
    });

    return null;
  },
});
