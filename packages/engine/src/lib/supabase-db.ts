/**
 * Supabase-backed persistence for the bot engine.
 * Replaces the secret-guarded Convex engineData HTTP client.
 */
import crypto from 'node:crypto';
import {
  hasLiveTradingAccess,
  resolveStrategyLists,
} from '@autotrade/shared';
import { env } from '../config/env';
import { AppError, ForbiddenError, NotFoundError } from './errors';
import { getSupabase } from './supabase';
import type {
  ActiveBotUserRecord,
  ActiveUserRecord,
  BotContextRecord,
  BotMode,
  BotSettingsRecord,
  DecryptedBrokerKeys,
  DigestTradeRecord,
  RiskLevel,
  SignalAction,
  TradeRecord,
  TradeResult,
  TradeSide,
  UserRole,
  UserStatus,
  SubscriptionStatus,
} from '../types/db';

export type CreateSignalArgs = {
  clerkId: string;
  ticker: string;
  exchange: string;
  price: number;
  timeframe: string;
  strategy: string;
  action: SignalAction;
  confidence: number;
  riskLevel: RiskLevel;
  entryReason: string;
  stopLoss?: number;
  takeProfit?: number;
  rrRatio?: number;
  explanation: string;
  createdAt?: number;
};

export type CreateTradeArgs = {
  clerkId: string;
  signalId?: string;
  symbol: string;
  exchange: string;
  side: TradeSide;
  mode: 'PAPER' | 'LIVE';
  qty: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy: string;
  confidence: number;
  entryReason: string;
  entrySnapshot?: unknown;
  brokerOrderId?: string;
  openedAt?: number;
};

export type CloseTradeArgs = {
  tradeId: string;
  exitPrice: number;
  exitReason?: string;
  mistakeTags?: string[];
  reasoningCorrect?: boolean;
  exitSnapshot?: unknown;
};

export type RecordStrategyOutcomeArgs = {
  clerkId: string;
  strategy: string;
  symbol: string;
  won: boolean;
  pnl: number;
};

export type WriteAuditLogArgs = {
  actorClerkId?: string;
  action: string;
  target?: string;
  meta?: unknown;
  ip?: string;
};

const STOCK_AGG = '__STOCK__';
const CRYPTO_AGG = '__CRYPTO__';
const BROKER_ALGORITHM = 'aes-256-gcm';

type UserRow = {
  clerk_id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  weekly_digest_enabled: boolean | null;
  founder_plan_override: BotContextRecord['founderPlanOverride'] | null;
};

type SubscriptionRow = {
  status: string;
  tier: string | null;
  current_period_end: number | null;
  legacy_tier: string | null;
  legacy_tier_until: number | null;
};

type BotSettingsRow = {
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
};

type TradeRow = {
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
};

type BrokerCredentialRow = {
  encrypted_key_id: string;
  encrypted_secret: string;
  paper: boolean;
  provider: string;
};

type StrategyStatsRow = {
  id: string;
  clerk_id: string;
  strategy: string;
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  total_pnl: number;
  expectancy: number;
  weighted_confidence: number;
};

export function getSecret(): string {
  if (!env.BOT_INTERNAL_SECRET) {
    throw new AppError(503, 'CONFIG_ERROR', 'BOT_INTERNAL_SECRET is not configured');
  }
  return env.BOT_INTERNAL_SECRET;
}

/** UTC midnight for the current day (ms since epoch). */
export function utcDayStartMs(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function supabaseError(op: string, error: { message: string }): never {
  throw new AppError(502, 'SUPABASE_ERROR', `Supabase ${op} failed: ${error.message}`);
}

function getBrokerEncryptionKey(): Buffer {
  const raw = process.env.BROKER_ENCRYPTION_KEY;
  if (!raw) {
    throw new AppError(503, 'CONFIG_ERROR', 'BROKER_ENCRYPTION_KEY is not set');
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return Buffer.from(raw, 'base64');
}

function decryptBrokerSecret(stored: string): string {
  const key = getBrokerEncryptionKey();
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new AppError(400, 'INVALID_CREDENTIAL', 'Invalid encrypted broker secret format');
  }
  const ivB64 = parts[0]!;
  const tagB64 = parts[1]!;
  const cipherB64 = parts[2]!;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');
  const decipher = crypto.createDecipheriv(BROKER_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

function shapeBotSettings(row: BotSettingsRow): BotSettingsRecord {
  const strategies = row.strategies ?? [];
  const resolved = resolveStrategyLists({
    strategies,
    stockStrategies: row.stock_strategies ?? undefined,
    cryptoStrategies: row.crypto_strategies ?? undefined,
  });
  return {
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
    strategies,
    stockStrategies: resolved.stockStrategies,
    cryptoStrategies: resolved.cryptoStrategies,
    includeExperimental: row.include_experimental ?? false,
    disabledStrategies: row.disabled_strategies ?? [],
  };
}

function mapTradeRow(row: TradeRow): TradeRecord {
  return {
    _id: row.id,
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

function mapSubscription(row: SubscriptionRow | null) {
  if (!row) return null;
  return {
    status: row.status as SubscriptionStatus,
    tier: row.tier ?? undefined,
    currentPeriodEnd: row.current_period_end ?? undefined,
  };
}

function subscriptionSnapshot(row: SubscriptionRow | null) {
  if (!row) return null;
  return {
    status: row.status,
    tier: row.tier,
    currentPeriodEnd: row.current_period_end,
    legacyTier: row.legacy_tier,
    legacyTierUntil: row.legacy_tier_until,
  };
}

export async function getBotContext(clerkId: string): Promise<BotContextRecord | null> {
  const sb = getSupabase();

  const [userRes, settingsRes, watchedRes, paperRes, subRes] = await Promise.all([
    sb.from('users').select('clerk_id, email, role, status, weekly_digest_enabled, founder_plan_override').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('bot_settings').select('*').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('watched_symbols').select('symbol, exchange, mic').eq('clerk_id', clerkId),
    sb.from('paper_accounts').select('balance, equity').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('subscriptions').select('status, tier, current_period_end, legacy_tier, legacy_tier_until').eq('clerk_id', clerkId).maybeSingle(),
  ]);

  if (userRes.error) supabaseError('getBotContext(users)', userRes.error);
  if (settingsRes.error) supabaseError('getBotContext(bot_settings)', settingsRes.error);
  if (watchedRes.error) supabaseError('getBotContext(watched_symbols)', watchedRes.error);
  if (paperRes.error) supabaseError('getBotContext(paper_accounts)', paperRes.error);
  if (subRes.error) supabaseError('getBotContext(subscriptions)', subRes.error);

  const user = userRes.data as UserRow | null;
  if (!user) return null;

  const sub = subRes.data as SubscriptionRow | null;
  const liveEntitled = hasLiveTradingAccess(
    user.role,
    subscriptionSnapshot(sub),
    user.email,
    user.founder_plan_override ?? null,
  );

  return {
    email: user.email,
    role: user.role,
    status: user.status,
    botSettings: settingsRes.data ? shapeBotSettings(settingsRes.data as BotSettingsRow) : null,
    watchlist: (watchedRes.data ?? []).map((w) => ({
      symbol: w.symbol as string,
      exchange: w.exchange as string,
      mic: (w.mic as string | null) ?? undefined,
    })),
    paperAccount: paperRes.data
      ? { balance: paperRes.data.balance as number, equity: paperRes.data.equity as number }
      : null,
    subscription: mapSubscription(sub),
    liveEntitled,
    founderPlanOverride: user.founder_plan_override ?? undefined,
  };
}

export async function countOpenTrades(clerkId: string, mode?: BotMode): Promise<number> {
  let query = getSupabase()
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_id', clerkId)
    .eq('result', 'OPEN');

  if (mode) query = query.eq('mode', mode);

  const { count, error } = await query;
  if (error) supabaseError('countOpenTrades', error);
  return count ?? 0;
}

export async function countPaperTrades(clerkId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_id', clerkId)
    .eq('mode', 'PAPER');

  if (error) supabaseError('countPaperTrades', error);
  return count ?? 0;
}

export async function countTradesOpenedSince(clerkId: string, sinceMs?: number): Promise<number> {
  const since = sinceMs ?? utcDayStartMs();
  const { count, error } = await getSupabase()
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_id', clerkId)
    .gte('opened_at', since);

  if (error) supabaseError('countTradesOpenedSince', error);
  return count ?? 0;
}

export async function realizedPnlToday(clerkId: string, dayStartMs?: number): Promise<number> {
  const dayStart = dayStartMs ?? utcDayStartMs();
  const { data, error } = await getSupabase()
    .from('trades')
    .select('pnl, result, closed_at')
    .eq('clerk_id', clerkId)
    .neq('result', 'OPEN')
    .gte('closed_at', dayStart);

  if (error) supabaseError('realizedPnlToday', error);

  let sum = 0;
  for (const row of data ?? []) {
    if (row.closed_at == null) continue;
    sum += (row.pnl as number | null) ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

export async function findOpenTradeBySymbol(
  clerkId: string,
  symbol: string,
  mode: BotMode,
): Promise<TradeRecord | null> {
  const sym = symbol.toUpperCase();
  const { data, error } = await getSupabase()
    .from('trades')
    .select('*')
    .eq('clerk_id', clerkId)
    .eq('result', 'OPEN')
    .eq('symbol', sym)
    .eq('mode', mode)
    .maybeSingle();

  if (error) supabaseError('findOpenTradeBySymbol', error);
  return data ? mapTradeRow(data as TradeRow) : null;
}

export async function getOpenTrades(clerkId: string, mode?: BotMode): Promise<TradeRecord[]> {
  let query = getSupabase()
    .from('trades')
    .select('*')
    .eq('clerk_id', clerkId)
    .eq('result', 'OPEN');

  if (mode) query = query.eq('mode', mode);

  const { data, error } = await query;
  if (error) supabaseError('getOpenTrades', error);
  return (data ?? []).map((row) => mapTradeRow(row as TradeRow));
}

export async function getOpenTradesBySymbol(symbol: string): Promise<TradeRecord[]> {
  const sym = symbol.toUpperCase();
  const { data, error } = await getSupabase()
    .from('trades')
    .select('*')
    .eq('symbol', sym)
    .eq('mode', 'PAPER')
    .eq('result', 'OPEN');

  if (error) supabaseError('getOpenTradesBySymbol', error);
  return (data ?? []).map((row) => mapTradeRow(row as TradeRow));
}

export async function countSignalsSince(clerkId: string, sinceMs: number): Promise<number> {
  const { count, error } = await getSupabase()
    .from('signals')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_id', clerkId)
    .gte('created_at', new Date(sinceMs).toISOString());

  if (error) supabaseError('countSignalsSince', error);
  return count ?? 0;
}

export async function getStrategyWeights(
  clerkId: string,
  assetClass: 'stock' | 'crypto',
): Promise<Record<string, number>> {
  const key = assetClass === 'crypto' ? CRYPTO_AGG : STOCK_AGG;
  const { data, error } = await getSupabase()
    .from('strategy_stats')
    .select('strategy, symbol, weighted_confidence')
    .eq('clerk_id', clerkId)
    .eq('symbol', key);

  if (error) supabaseError('getStrategyWeights', error);

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    out[row.strategy as string] = row.weighted_confidence as number;
  }
  return out;
}

export async function getActiveBotUsers(): Promise<ActiveBotUserRecord[]> {
  const sb = getSupabase();

  const { data: users, error: usersError } = await sb
    .from('users')
    .select('clerk_id, status')
    .eq('status', 'ACTIVE');

  if (usersError) supabaseError('getActiveBotUsers(users)', usersError);

  const out: ActiveBotUserRecord[] = [];

  for (const user of users ?? []) {
    const clerkId = user.clerk_id as string;
    const { data: settings, error: settingsError } = await sb
      .from('bot_settings')
      .select('mode')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (settingsError) supabaseError('getActiveBotUsers(bot_settings)', settingsError);
    if (!settings || settings.mode === 'DISABLED') continue;

    const { data: watched, error: watchedError } = await sb
      .from('watched_symbols')
      .select('symbol')
      .eq('clerk_id', clerkId);

    if (watchedError) supabaseError('getActiveBotUsers(watched_symbols)', watchedError);

    out.push({
      clerkId,
      symbols: (watched ?? []).map((w) => (w.symbol as string).toUpperCase()),
    });
  }

  return out;
}

export async function getDigestTrades(
  clerkId: string,
  sinceMs: number,
): Promise<DigestTradeRecord[]> {
  const { data, error } = await getSupabase()
    .from('trades')
    .select('symbol, pnl, result, closed_at')
    .eq('clerk_id', clerkId)
    .neq('result', 'OPEN')
    .gte('closed_at', sinceMs);

  if (error) supabaseError('getDigestTrades', error);

  return (data ?? []).map((row) => ({
    symbol: row.symbol as string,
    pnl: (row.pnl as number | null) ?? 0,
    result: row.result as 'WIN' | 'LOSS' | 'BREAKEVEN',
  }));
}

export async function listActiveUsers(): Promise<ActiveUserRecord[]> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('clerk_id, email, weekly_digest_enabled, status')
    .eq('status', 'ACTIVE');

  if (error) supabaseError('listActiveUsers', error);

  return (data ?? [])
    .filter((u) => u.weekly_digest_enabled !== false)
    .map((u) => ({
      clerkId: u.clerk_id as string,
      email: u.email as string,
    }));
}

export async function createSignal(args: CreateSignalArgs): Promise<string> {
  const createdAt = args.createdAt ?? Date.now();
  const row = {
    clerk_id: args.clerkId,
    ticker: args.ticker,
    exchange: args.exchange,
    price: args.price,
    timeframe: args.timeframe,
    strategy: args.strategy,
    action: args.action,
    confidence: args.confidence,
    risk_level: args.riskLevel,
    entry_reason: args.entryReason,
    stop_loss: args.stopLoss ?? null,
    take_profit: args.takeProfit ?? null,
    rr_ratio: args.rrRatio ?? null,
    explanation: args.explanation,
    created_at: new Date(createdAt).toISOString(),
  };

  const { data, error } = await getSupabase().from('signals').insert(row).select('id').single();
  if (error) supabaseError('createSignal', error);
  return data.id as string;
}

export async function createTrade(args: CreateTradeArgs): Promise<string> {
  if (args.mode === 'LIVE') {
    const sb = getSupabase();
    const [userRes, subRes] = await Promise.all([
      sb.from('users').select('role, email, founder_plan_override').eq('clerk_id', args.clerkId).maybeSingle(),
      sb.from('subscriptions').select('status, tier, current_period_end, legacy_tier, legacy_tier_until').eq('clerk_id', args.clerkId).maybeSingle(),
    ]);
    if (userRes.error) supabaseError('createTrade(users)', userRes.error);
    if (subRes.error) supabaseError('createTrade(subscriptions)', subRes.error);

    const user = userRes.data as Pick<UserRow, 'role' | 'email' | 'founder_plan_override'> | null;
    const sub = subRes.data as SubscriptionRow | null;
    if (
      !hasLiveTradingAccess(
        user?.role ?? 'USER',
        subscriptionSnapshot(sub),
        user?.email,
        user?.founder_plan_override ?? null,
      )
    ) {
      throw new ForbiddenError('Live trading is not permitted for this account.');
    }
  }

  const row = {
    clerk_id: args.clerkId,
    signal_id: args.signalId ?? null,
    symbol: args.symbol.toUpperCase(),
    exchange: args.exchange,
    side: args.side,
    mode: args.mode,
    qty: args.qty,
    entry_price: args.entryPrice,
    stop_loss: args.stopLoss ?? null,
    take_profit: args.takeProfit ?? null,
    strategy: args.strategy,
    confidence: args.confidence,
    entry_reason: args.entryReason,
    entry_snapshot: args.entrySnapshot ?? null,
    broker_order_id: args.brokerOrderId ?? null,
    result: 'OPEN' as const,
    mistake_tags: [] as string[],
    opened_at: args.openedAt ?? Date.now(),
  };

  const { data, error } = await getSupabase().from('trades').insert(row).select('id').single();
  if (error) supabaseError('createTrade', error);
  return data.id as string;
}

export async function closeTrade(
  args: CloseTradeArgs,
): Promise<{ pnl: number; result: Exclude<TradeResult, 'OPEN'> }> {
  const sb = getSupabase();
  const { data: trade, error: fetchError } = await sb
    .from('trades')
    .select('*')
    .eq('id', args.tradeId)
    .maybeSingle();

  if (fetchError) supabaseError('closeTrade(fetch)', fetchError);
  if (!trade) throw new NotFoundError('Trade not found');

  const row = trade as TradeRow;
  if (row.result !== 'OPEN') {
    throw new AppError(409, 'CONFLICT', 'Trade is already closed');
  }

  const rawPnl =
    row.side === 'LONG'
      ? (args.exitPrice - row.entry_price) * row.qty
      : (row.entry_price - args.exitPrice) * row.qty;
  const pnl = Math.round(rawPnl * 100) / 100;

  let result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  if (pnl > 0) result = 'WIN';
  else if (pnl < 0) result = 'LOSS';
  else result = 'BREAKEVEN';

  const { error: updateError } = await sb
    .from('trades')
    .update({
      exit_price: args.exitPrice,
      pnl,
      result,
      exit_reason: args.exitReason ?? null,
      mistake_tags: args.mistakeTags ?? [],
      reasoning_correct: args.reasoningCorrect ?? null,
      exit_snapshot: args.exitSnapshot ?? null,
      closed_at: Date.now(),
    })
    .eq('id', args.tradeId);

  if (updateError) supabaseError('closeTrade(update)', updateError);
  return { pnl, result };
}

export async function adjustPaperAccount(
  clerkId: string,
  balanceDelta: number,
  equityDelta: number,
): Promise<{ balance: number; equity: number } | null> {
  const sb = getSupabase();
  const { data: account, error: fetchError } = await sb
    .from('paper_accounts')
    .select('id, balance, equity')
    .eq('clerk_id', clerkId)
    .maybeSingle();

  if (fetchError) supabaseError('adjustPaperAccount(fetch)', fetchError);
  if (!account) return null;

  const balance = (account.balance as number) + balanceDelta;
  const equity = (account.equity as number) + equityDelta;

  const { error: updateError } = await sb
    .from('paper_accounts')
    .update({ balance, equity })
    .eq('id', account.id as string);

  if (updateError) supabaseError('adjustPaperAccount(update)', updateError);
  return { balance, equity };
}

export async function setPaperEquity(
  clerkId: string,
  equity: number,
): Promise<{ balance: number; equity: number } | null> {
  const sb = getSupabase();
  const { data: account, error: fetchError } = await sb
    .from('paper_accounts')
    .select('id, balance')
    .eq('clerk_id', clerkId)
    .maybeSingle();

  if (fetchError) supabaseError('setPaperEquity(fetch)', fetchError);
  if (!account) return null;

  const { error: updateError } = await sb
    .from('paper_accounts')
    .update({ equity })
    .eq('id', account.id as string);

  if (updateError) supabaseError('setPaperEquity(update)', updateError);
  return { balance: account.balance as number, equity };
}

export async function recordStrategyOutcome(args: RecordStrategyOutcomeArgs): Promise<void> {
  const sb = getSupabase();
  const { data: existing, error: fetchError } = await sb
    .from('strategy_stats')
    .select('*')
    .eq('clerk_id', args.clerkId)
    .eq('strategy', args.strategy)
    .eq('symbol', args.symbol)
    .maybeSingle();

  if (fetchError) supabaseError('recordStrategyOutcome(fetch)', fetchError);

  if (existing) {
    const row = existing as StrategyStatsRow;
    const trades = row.trades + 1;
    const wins = row.wins + (args.won ? 1 : 0);
    const losses = row.losses + (args.won ? 0 : 1);
    const totalPnl = row.total_pnl + args.pnl;
    const expectancy = totalPnl / trades;
    const winRate = wins / trades;
    const raw = 0.5 + winRate;
    const weightedConfidence = Math.max(0.5, Math.min(1.5, raw));

    const { error: updateError } = await sb
      .from('strategy_stats')
      .update({
        trades,
        wins,
        losses,
        total_pnl: totalPnl,
        expectancy,
        weighted_confidence: weightedConfidence,
      })
      .eq('id', row.id);

    if (updateError) supabaseError('recordStrategyOutcome(update)', updateError);
    return;
  }

  const { error: insertError } = await sb.from('strategy_stats').insert({
    clerk_id: args.clerkId,
    strategy: args.strategy,
    symbol: args.symbol,
    trades: 1,
    wins: args.won ? 1 : 0,
    losses: args.won ? 0 : 1,
    total_pnl: args.pnl,
    expectancy: args.pnl,
    weighted_confidence: 1.0,
  });

  if (insertError) supabaseError('recordStrategyOutcome(insert)', insertError);
}

export async function writeAuditLog(args: WriteAuditLogArgs): Promise<void> {
  const { error } = await getSupabase().from('audit_logs').insert({
    actor_clerk_id: args.actorClerkId ?? null,
    action: args.action,
    target: args.target ?? null,
    meta: args.meta ?? null,
    ip: args.ip ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) supabaseError('writeAuditLog', error);
}

export async function getDecryptedBrokerKeys(
  clerkId: string,
  paper: boolean,
): Promise<DecryptedBrokerKeys | null> {
  const { data, error } = await getSupabase()
    .from('broker_credentials')
    .select('encrypted_key_id, encrypted_secret, paper, provider')
    .eq('clerk_id', clerkId)
    .eq('paper', paper)
    .maybeSingle();

  if (error) supabaseError('getDecryptedBrokerKeys', error);
  if (!data) return null;

  const cred = data as BrokerCredentialRow;
  return {
    keyId: decryptBrokerSecret(cred.encrypted_key_id),
    secret: decryptBrokerSecret(cred.encrypted_secret),
    paper: cred.paper,
    provider: cred.provider,
  };
}

/** Clerk IDs of active users whose scan interval has elapsed. */
export async function getUsersDueForScan(now = Date.now()): Promise<string[]> {
  const sb = getSupabase();
  const { data: settings, error: settingsError } = await sb
    .from('bot_settings')
    .select('clerk_id, scan_interval_seconds, last_scan_at, mode')
    .neq('mode', 'DISABLED');

  if (settingsError) supabaseError('getUsersDueForScan(bot_settings)', settingsError);

  const { normalizeScanInterval } = await import('@autotrade/shared');
  const out: string[] = [];

  for (const row of settings ?? []) {
    const clerkId = row.clerk_id as string;
    const { data: user, error: userError } = await sb
      .from('users')
      .select('status')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (userError) supabaseError('getUsersDueForScan(users)', userError);
    if (!user || user.status !== 'ACTIVE') continue;

    const intervalMs = normalizeScanInterval(row.scan_interval_seconds ?? undefined) * 1000;
    const lastScan = (row.last_scan_at as number | null) ?? 0;
    if (now - lastScan >= intervalMs) out.push(clerkId);
  }

  return out;
}

export async function recordScanCompleted(clerkId: string, at: number): Promise<void> {
  const { error } = await getSupabase()
    .from('bot_settings')
    .update({ last_scan_at: at })
    .eq('clerk_id', clerkId);

  if (error) supabaseError('recordScanCompleted', error);
}
