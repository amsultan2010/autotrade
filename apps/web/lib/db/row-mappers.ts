/** snake_case ↔ camelCase row mapping for Supabase Postgres tables. */

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function toMsFromTimestamptz(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

export function mapKeysToCamel<T extends Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out as T;
}

export function mapKeysToSnake(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

export type UserRole = 'USER' | 'ADMIN' | 'DEVELOPER';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'UNPAID';
export type BotMode = 'DISABLED' | 'PAPER' | 'LIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type TradeResult = 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
export type TradeSide = 'LONG' | 'SHORT';

export interface UserRow {
  id: string;
  clerk_id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  alpaca_guide_completed: boolean | null;
  product_tour_completed: boolean | null;
  welcome_email_sent_at: number | null;
  weekly_digest_enabled: boolean | null;
  founder_plan_override: 'free' | 'essential' | 'pro' | 'unlimited' | null;
  resend_contact_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  clerkId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  alpacaGuideCompleted?: boolean;
  productTourCompleted?: boolean;
  welcomeEmailSentAt?: number;
  weeklyDigestEnabled?: boolean;
  founderPlanOverride?: 'free' | 'essential' | 'pro' | 'unlimited';
  resendContactId?: string;
  _creationTime: number;
}

export function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    clerkId: row.clerk_id,
    email: row.email,
    role: row.role,
    status: row.status,
    alpacaGuideCompleted: row.alpaca_guide_completed ?? undefined,
    productTourCompleted: row.product_tour_completed ?? undefined,
    welcomeEmailSentAt: row.welcome_email_sent_at ?? undefined,
    weeklyDigestEnabled: row.weekly_digest_enabled ?? undefined,
    founderPlanOverride: row.founder_plan_override ?? undefined,
    resendContactId: row.resend_contact_id ?? undefined,
    _creationTime: toMsFromTimestamptz(row.created_at) ?? Date.now(),
  };
}

export interface SubscriptionRow {
  id: string;
  clerk_id: string;
  tier: string | null;
  status: SubscriptionStatus;
  current_period_end: number | null;
  cancel_at_period_end: boolean | null;
  legacy_tier: string | null;
  legacy_tier_until: number | null;
  trials_used: string[] | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface SubscriptionRecord {
  _id: string;
  _creationTime: number;
  clerkId: string;
  tier?: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  legacyTier?: string;
  legacyTierUntil?: number;
  trialsUsed?: string[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export function mapSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    _id: row.id,
    _creationTime: toMsFromTimestamptz(row.created_at) ?? Date.now(),
    clerkId: row.clerk_id,
    tier: row.tier ?? undefined,
    status: row.status,
    currentPeriodEnd: row.current_period_end ?? undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? undefined,
    legacyTier: row.legacy_tier ?? undefined,
    legacyTierUntil: row.legacy_tier_until ?? undefined,
    trialsUsed: row.trials_used ?? undefined,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
  };
}

export interface TradeRow {
  id: string;
  clerk_id: string;
  signal_id: string | null;
  symbol: string;
  exchange: string;
  side: TradeSide;
  mode: BotMode;
  qty: number;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number | null;
  result: TradeResult;
  strategy: string;
  confidence: number;
  entry_reason: string;
  exit_reason: string | null;
  mistake_tags: string[];
  entry_snapshot: unknown;
  exit_snapshot: unknown;
  reasoning_correct: boolean | null;
  broker_order_id: string | null;
  opened_at: number;
  closed_at: number | null;
  created_at: string;
}

export interface TradeRecord {
  _id: string;
  _creationTime: number;
  clerkId: string;
  signalId?: string;
  symbol: string;
  exchange: string;
  side: TradeSide;
  mode: BotMode;
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  result: TradeResult;
  strategy: string;
  confidence: number;
  entryReason: string;
  exitReason?: string;
  mistakeTags: string[];
  entrySnapshot?: unknown;
  exitSnapshot?: unknown;
  reasoningCorrect?: boolean;
  brokerOrderId?: string;
  openedAt: number;
  closedAt?: number;
}

export function mapTrade(row: TradeRow): TradeRecord {
  return {
    _id: row.id,
    _creationTime: toMsFromTimestamptz(row.created_at) ?? row.opened_at,
    clerkId: row.clerk_id,
    signalId: row.signal_id ?? undefined,
    symbol: row.symbol,
    exchange: row.exchange,
    side: row.side,
    mode: row.mode,
    qty: row.qty,
    entryPrice: row.entry_price,
    exitPrice: row.exit_price ?? undefined,
    stopLoss: row.stop_loss ?? undefined,
    takeProfit: row.take_profit ?? undefined,
    pnl: row.pnl ?? undefined,
    result: row.result,
    strategy: row.strategy,
    confidence: row.confidence,
    entryReason: row.entry_reason,
    exitReason: row.exit_reason ?? undefined,
    mistakeTags: row.mistake_tags ?? [],
    entrySnapshot: row.entry_snapshot ?? undefined,
    exitSnapshot: row.exit_snapshot ?? undefined,
    reasoningCorrect: row.reasoning_correct ?? undefined,
    brokerOrderId: row.broker_order_id ?? undefined,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
  };
}

export interface BotSettingsRow {
  id: string;
  clerk_id: string;
  mode: BotMode;
  risk_level: RiskLevel;
  max_active_trades: number;
  max_trade_size: number;
  risk_per_trade_pct: number;
  default_stop_pct: number;
  default_take_profit_pct: number;
  max_daily_loss: number;
  trading_hours_start: string;
  trading_hours_end: string;
  min_confidence: number;
  timeframes: string[];
  strategies: string[];
  stock_strategies: string[] | null;
  crypto_strategies: string[] | null;
  include_experimental: boolean | null;
  disabled_strategies: string[] | null;
  scan_interval_seconds: number | null;
  last_scan_at: number | null;
  preset_switches_this_week: number | null;
  preset_week_started_at: number | null;
  created_at: string;
}

export interface BotSettingsRecord {
  _id: string;
  _creationTime: number;
  clerkId: string;
  mode: BotMode;
  riskLevel: RiskLevel;
  maxActiveTrades: number;
  maxTradeSize: number;
  riskPerTradePct: number;
  defaultStopPct: number;
  defaultTakeProfitPct: number;
  maxDailyLoss: number;
  tradingHoursStart: string;
  tradingHoursEnd: string;
  minConfidence: number;
  timeframes: string[];
  strategies: string[];
  stockStrategies?: string[];
  cryptoStrategies?: string[];
  includeExperimental?: boolean;
  disabledStrategies?: string[];
  scanIntervalSeconds?: number;
  lastScanAt?: number;
  presetSwitchesThisWeek?: number;
  presetWeekStartedAt?: number;
}

export function mapBotSettings(row: BotSettingsRow): BotSettingsRecord {
  return {
    _id: row.id,
    _creationTime: toMsFromTimestamptz(row.created_at) ?? Date.now(),
    clerkId: row.clerk_id,
    mode: row.mode,
    riskLevel: row.risk_level,
    maxActiveTrades: row.max_active_trades,
    maxTradeSize: row.max_trade_size,
    riskPerTradePct: row.risk_per_trade_pct,
    defaultStopPct: row.default_stop_pct,
    defaultTakeProfitPct: row.default_take_profit_pct,
    maxDailyLoss: row.max_daily_loss,
    tradingHoursStart: row.trading_hours_start,
    tradingHoursEnd: row.trading_hours_end,
    minConfidence: row.min_confidence,
    timeframes: row.timeframes,
    strategies: row.strategies ?? [],
    stockStrategies: row.stock_strategies ?? undefined,
    cryptoStrategies: row.crypto_strategies ?? undefined,
    includeExperimental: row.include_experimental ?? undefined,
    disabledStrategies: row.disabled_strategies ?? undefined,
    scanIntervalSeconds: row.scan_interval_seconds ?? undefined,
    lastScanAt: row.last_scan_at ?? undefined,
    presetSwitchesThisWeek: row.preset_switches_this_week ?? undefined,
    presetWeekStartedAt: row.preset_week_started_at ?? undefined,
  };
}

export interface WatchedSymbolRow {
  id: string;
  clerk_id: string;
  symbol: string;
  exchange: string;
  mic: string | null;
  added_at: number;
}

export interface WatchedSymbolRecord {
  _id: string;
  clerkId: string;
  symbol: string;
  exchange: string;
  mic?: string;
  addedAt: number;
}

export function mapWatchedSymbol(row: WatchedSymbolRow): WatchedSymbolRecord {
  return {
    _id: row.id,
    clerkId: row.clerk_id,
    symbol: row.symbol,
    exchange: row.exchange,
    mic: row.mic ?? undefined,
    addedAt: row.added_at,
  };
}

export interface BrokerSnapshotRow {
  id: string;
  clerk_id: string;
  equity: number;
  cash: number;
  buying_power: number;
  last_equity: number | null;
  mode: 'paper' | 'live';
  positions: unknown;
  synced_at: number;
  sync_error: string | null;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  side: 'LONG' | 'SHORT';
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
}

export interface BrokerSnapshotRecord {
  _id: string;
  clerkId: string;
  equity: number;
  cash: number;
  buyingPower: number;
  lastEquity?: number;
  mode: 'paper' | 'live';
  positions: BrokerPosition[];
  syncedAt: number;
  syncError?: string;
}

export function mapBrokerSnapshot(row: BrokerSnapshotRow): BrokerSnapshotRecord {
  const positions = Array.isArray(row.positions) ? (row.positions as BrokerPosition[]) : [];
  return {
    _id: row.id,
    clerkId: row.clerk_id,
    equity: row.equity,
    cash: row.cash,
    buyingPower: row.buying_power,
    lastEquity: row.last_equity ?? undefined,
    mode: row.mode,
    positions,
    syncedAt: row.synced_at,
    syncError: row.sync_error ?? undefined,
  };
}
