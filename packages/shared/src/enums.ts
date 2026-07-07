/**
 * Shared enums / literal unions used across backend and desktop.
 * Kept as const arrays + derived unions so they are usable as runtime values
 * (e.g. for validation lists) and as types.
 */

export const ROLES = ['USER', 'ADMIN', 'DEVELOPER'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'NONE',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'TRIALING',
  'UNPAID',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Execution mode  -  defaults to PAPER. LIVE only via real broker integration. */
export const EXECUTION_MODES = ['DISABLED', 'PAPER', 'LIVE'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TRADE_ACTIONS = ['BUY', 'SELL', 'HOLD', 'AVOID', 'CLOSE'] as const;
export type TradeAction = (typeof TRADE_ACTIONS)[number];

export const TRADE_SIDES = ['LONG', 'SHORT'] as const;
export type TradeSide = (typeof TRADE_SIDES)[number];

export const TRADE_RESULTS = ['OPEN', 'WIN', 'LOSS', 'BREAKEVEN'] as const;
export type TradeResult = (typeof TRADE_RESULTS)[number];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Registered strategy identifiers. Extend as the engine grows. */
export const STRATEGIES = [
  'TrendBreakout',
  'PullbackContinuation',
  'MeanReversion',
  'CryptoMomentum',
] as const;
export type StrategyId = (typeof STRATEGIES)[number];

/** Canonical mistake tags applied to closed trades (req #11). */
export const MISTAKE_TAGS = [
  'LATE_ENTRY',
  'EARLY_EXIT',
  'FALSE_BREAKOUT',
  'WEAK_TREND',
  'LOW_VOLUME',
  'BAD_RISK_REWARD',
  'STOP_LOSS_HIT',
  'TOOK_PROFIT_TOO_EARLY',
  'HELD_TOO_LONG',
  'HIGH_VOLATILITY_ENTRY',
  'IGNORED_RESISTANCE',
  'IGNORED_SUPPORT',
] as const;
export type MistakeTag = (typeof MISTAKE_TAGS)[number];
