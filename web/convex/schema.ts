import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ── Users ────────────────────────────────────────────────────────────────
  // Mirrors Clerk user data. clerkId is the Clerk subject (user ID).
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal('USER'), v.literal('ADMIN'), v.literal('DEVELOPER')),
    status: v.union(v.literal('ACTIVE'), v.literal('DISABLED')),
    /** false = show onboarding; undefined = legacy user (skip onboarding). */
    alpacaGuideCompleted: v.optional(v.boolean()),
    /** false = show dashboard product tour after onboarding; undefined = legacy user (skip tour). */
    productTourCompleted: v.optional(v.boolean()),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email']),

  // ── Subscriptions ─────────────────────────────────────────────────────────
  subscriptions: defineTable({
    clerkId: v.string(),
    tier: v.optional(v.string()),
    status: v.union(
      v.literal('NONE'),
      v.literal('ACTIVE'),
      v.literal('PAST_DUE'),
      v.literal('CANCELED'),
      v.literal('TRIALING'),
    ),
    currentPeriodEnd: v.optional(v.number()), // epoch ms
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_stripe_customer_id', ['stripeCustomerId']),

  // ── Watchlist ─────────────────────────────────────────────────────────────
  watchedSymbols: defineTable({
    clerkId: v.string(),
    symbol: v.string(),
    exchange: v.string(),
    mic: v.optional(v.string()),
    addedAt: v.number(), // epoch ms
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_clerk_symbol_exchange', ['clerkId', 'symbol', 'exchange']),

  // ── Bot & Risk Settings ───────────────────────────────────────────────────
  botSettings: defineTable({
    clerkId: v.string(),
    mode: v.union(v.literal('DISABLED'), v.literal('PAPER'), v.literal('LIVE')),
    riskLevel: v.union(v.literal('LOW'), v.literal('MEDIUM'), v.literal('HIGH')),
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
  }).index('by_clerk_id', ['clerkId']),

  // ── Signals ───────────────────────────────────────────────────────────────
  signals: defineTable({
    clerkId: v.string(),
    ticker: v.string(),
    exchange: v.string(),
    price: v.number(),
    timeframe: v.string(),
    strategy: v.string(),
    action: v.union(
      v.literal('BUY'),
      v.literal('SELL'),
      v.literal('HOLD'),
      v.literal('AVOID'),
      v.literal('CLOSE'),
    ),
    confidence: v.number(),
    riskLevel: v.union(v.literal('LOW'), v.literal('MEDIUM'), v.literal('HIGH')),
    entryReason: v.string(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    rrRatio: v.optional(v.number()),
    explanation: v.string(),
    createdAt: v.number(), // epoch ms
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_ticker', ['ticker']),

  // ── Trades ────────────────────────────────────────────────────────────────
  trades: defineTable({
    clerkId: v.string(),
    signalId: v.optional(v.id('signals')),
    symbol: v.string(),
    exchange: v.string(),
    side: v.union(v.literal('LONG'), v.literal('SHORT')),
    mode: v.union(v.literal('DISABLED'), v.literal('PAPER'), v.literal('LIVE')),
    qty: v.number(),
    entryPrice: v.number(),
    exitPrice: v.optional(v.number()),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    pnl: v.optional(v.number()),
    result: v.union(
      v.literal('OPEN'),
      v.literal('WIN'),
      v.literal('LOSS'),
      v.literal('BREAKEVEN'),
    ),
    strategy: v.string(),
    confidence: v.number(),
    entryReason: v.string(),
    exitReason: v.optional(v.string()),
    mistakeTags: v.array(v.string()),
    entrySnapshot: v.optional(v.any()),
    exitSnapshot: v.optional(v.any()),
    reasoningCorrect: v.optional(v.boolean()),
    brokerOrderId: v.optional(v.string()),
    openedAt: v.number(), // epoch ms
    closedAt: v.optional(v.number()), // epoch ms
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_clerk_result', ['clerkId', 'result'])
    .index('by_symbol', ['symbol']),

  // ── Paper Account ─────────────────────────────────────────────────────────
  paperAccounts: defineTable({
    clerkId: v.string(),
    balance: v.number(),
    equity: v.number(),
  }).index('by_clerk_id', ['clerkId']),

  // ── Strategy Stats ────────────────────────────────────────────────────────
  strategyStats: defineTable({
    clerkId: v.string(),
    strategy: v.string(),
    symbol: v.string(), // "" = aggregate across all symbols
    trades: v.number(),
    wins: v.number(),
    losses: v.number(),
    totalPnl: v.number(),
    expectancy: v.number(),
    weightedConfidence: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_clerk_strategy_symbol', ['clerkId', 'strategy', 'symbol']),

  // ── Broker Credentials ────────────────────────────────────────────────────
  // Only stores encrypted secrets — raw keys never written to Convex DB.
  brokerCredentials: defineTable({
    clerkId: v.string(),
    provider: v.string(),
    encryptedKeyId: v.string(),
    encryptedSecret: v.string(),
    paper: v.boolean(),
  }).index('by_clerk_id', ['clerkId']),

  // ── Broker Snapshots ──────────────────────────────────────────────────────
  // Cached Alpaca account + positions for reactive dashboard updates.
  brokerSnapshots: defineTable({
    clerkId: v.string(),
    equity: v.number(),
    cash: v.number(),
    buyingPower: v.number(),
    lastEquity: v.optional(v.number()),
    mode: v.union(v.literal('paper'), v.literal('live')),
    positions: v.array(
      v.object({
        symbol: v.string(),
        qty: v.number(),
        avgEntryPrice: v.number(),
        side: v.union(v.literal('LONG'), v.literal('SHORT')),
        currentPrice: v.optional(v.number()),
        marketValue: v.optional(v.number()),
        unrealizedPnl: v.optional(v.number()),
        unrealizedPnlPct: v.optional(v.number()),
      }),
    ),
    syncedAt: v.number(),
    syncError: v.optional(v.string()),
  }).index('by_clerk_id', ['clerkId']),

  // ── Audit Logs ────────────────────────────────────────────────────────────
  auditLogs: defineTable({
    actorClerkId: v.optional(v.string()),
    action: v.string(),
    target: v.optional(v.string()),
    meta: v.optional(v.any()),
    ip: v.optional(v.string()),
    createdAt: v.number(), // epoch ms
  })
    .index('by_actor', ['actorClerkId'])
    .index('by_action', ['action']),
});
