import { BadRequestError, NotFoundError } from '@autotrade/engine/public';
import {
  FREE_PAPER_TRADE_LIMIT,
  FREE_TIER_LIMITS,
  isValidScanInterval,
  normalizeScanInterval,
  resolveStrategyLists,
  startOfUtcWeekMs,
} from '@autotrade/shared';
import { getSupabaseServer } from '@/lib/supabase-server';
import { isBillingEnabled } from '@/lib/billing';
import { DEFAULT_BOT_SETTINGS } from '@/lib/defaultBotSettings';
import {
  canAccessScanInterval,
  canUseExperimentalStrategies,
  canUsePaperTrading,
  countActiveStrategies,
  getPlanLimits,
  hasLiveTradingAccess,
  isLiveEntitled,
  maxPresetSwitchesPerWeek,
  requiresPaperSimulator,
} from '@/lib/entitlements';
import { ensureUserRecords } from './bootstrap';
import { getCredentialByPaper } from './broker';
import { mapBotSettings, type BotSettingsRecord, type BotSettingsRow } from './row-mappers';
import { getSubscriptionByClerkId } from './subscriptions';
import { me } from './users';
import { countPaperTrades } from './trades';

function paperTradesLimitForUser(
  role: string,
  sub: Awaited<ReturnType<typeof getSubscriptionByClerkId>>,
  email?: string | null,
  founderPlanOverride?: string | null,
): number {
  if (requiresPaperSimulator(role, sub, email, founderPlanOverride as never)) {
    return FREE_TIER_LIMITS.maxPaperTrades;
  }
  return FREE_PAPER_TRADE_LIMIT;
}

function enrichSettings(doc: BotSettingsRecord): BotSettingsRecord {
  const strategies = doc.strategies ?? [];
  const resolved = resolveStrategyLists({
    strategies,
    stockStrategies: doc.stockStrategies,
    cryptoStrategies: doc.cryptoStrategies,
  });
  return {
    ...doc,
    strategies,
    stockStrategies: resolved.stockStrategies,
    cryptoStrategies: resolved.cryptoStrategies,
    includeExperimental: doc.includeExperimental ?? false,
    disabledStrategies: doc.disabledStrategies ?? [],
    scanIntervalSeconds: normalizeScanInterval(doc.scanIntervalSeconds),
  };
}

async function getSettingsRow(clerkId: string): Promise<BotSettingsRecord | null> {
  const { data, error } = await getSupabaseServer()
    .from('bot_settings')
    .select('*')
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? enrichSettings(mapBotSettings(data as BotSettingsRow)) : null;
}

export async function getBotSettings(clerkId: string): Promise<BotSettingsRecord | null> {
  let settings = await getSettingsRow(clerkId);
  if (settings) return settings;

  const user = await me(clerkId);
  if (!user) return null;

  await ensureUserRecords(clerkId, user.email);
  return getSettingsRow(clerkId);
}

export type BotSettingsUpdate = Partial<{
  mode: 'DISABLED' | 'PAPER' | 'LIVE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
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
  stockStrategies: string[];
  cryptoStrategies: string[];
  includeExperimental: boolean;
  disabledStrategies: string[];
  scanIntervalSeconds: number;
}>;

const CAMEL_TO_SNAKE: Record<string, string> = {
  mode: 'mode',
  riskLevel: 'risk_level',
  maxActiveTrades: 'max_active_trades',
  maxTradeSize: 'max_trade_size',
  riskPerTradePct: 'risk_per_trade_pct',
  defaultStopPct: 'default_stop_pct',
  defaultTakeProfitPct: 'default_take_profit_pct',
  maxDailyLoss: 'max_daily_loss',
  tradingHoursStart: 'trading_hours_start',
  tradingHoursEnd: 'trading_hours_end',
  minConfidence: 'min_confidence',
  timeframes: 'timeframes',
  strategies: 'strategies',
  stockStrategies: 'stock_strategies',
  cryptoStrategies: 'crypto_strategies',
  includeExperimental: 'include_experimental',
  disabledStrategies: 'disabled_strategies',
  scanIntervalSeconds: 'scan_interval_seconds',
};

function toSnakePatch(args: BotSettingsUpdate): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    const snake = CAMEL_TO_SNAKE[k];
    if (snake) patch[snake] = v;
  }
  return patch;
}

export async function updateBotSettings(clerkId: string, args: BotSettingsUpdate): Promise<BotSettingsRecord> {
  let settings = await getSettingsRow(clerkId);
  if (!settings) {
    const user = await me(clerkId);
    if (!user) throw new NotFoundError('User not found');
    await ensureUserRecords(clerkId, user.email);
    settings = await getSettingsRow(clerkId);
    if (!settings) throw new BadRequestError('Bot settings not found. User not fully initialised.');
  }

  const user = await me(clerkId);
  const sub = await getSubscriptionByClerkId(clerkId);
  const role = user?.role ?? 'USER';
  const isBypassRole = role === 'ADMIN' || role === 'DEVELOPER';

  if (args.mode !== undefined && !isBypassRole) {
    if (args.mode === 'LIVE') {
      if (!hasLiveTradingAccess(role, sub, user?.email, user?.founderPlanOverride)) {
        throw new BadRequestError(
          isBillingEnabled()
            ? 'Live trading requires an active paid subscription.'
            : 'Live trading is not available yet.',
        );
      }
      const liveCred = await getCredentialByPaper(clerkId, false);
      if (!liveCred) throw new BadRequestError('Connect live Alpaca API keys before enabling LIVE mode.');
    }
  }

  if (args.includeExperimental === true && !isBypassRole) {
    if (!canUseExperimentalStrategies(role, sub, user?.email, user?.founderPlanOverride)) {
      throw new BadRequestError('Experimental strategies require Unlimited.');
    }
  }

  if (args.scanIntervalSeconds !== undefined) {
    if (!isValidScanInterval(args.scanIntervalSeconds)) {
      throw new BadRequestError('Scan interval must be between 1 and 44 seconds');
    }
    const currentInterval = normalizeScanInterval(settings.scanIntervalSeconds);
    if (
      args.scanIntervalSeconds !== currentInterval &&
      !isBypassRole &&
      !canAccessScanInterval(role, sub, args.scanIntervalSeconds, user?.email)
    ) {
      throw new BadRequestError('Your plan does not include this scan interval. Upgrade to unlock faster scans.');
    }
  }

  if (args.cryptoStrategies !== undefined && args.cryptoStrategies.length > 0) {
    const limits = getPlanLimits(role, sub, user?.email, user?.founderPlanOverride);
    if (!limits?.crypto) throw new BadRequestError('Crypto strategies require Pro or Unlimited.');
  }

  const strategyLists = {
    stockStrategies: args.stockStrategies ?? settings.stockStrategies ?? [],
    cryptoStrategies: args.cryptoStrategies ?? settings.cryptoStrategies ?? [],
  };
  if (args.stockStrategies !== undefined || args.cryptoStrategies !== undefined) {
    const limits = getPlanLimits(role, sub, user?.email, user?.founderPlanOverride);
    const max = limits?.maxActiveStrategies;
    const count = countActiveStrategies(strategyLists.stockStrategies, strategyLists.cryptoStrategies);
    if (max != null && count > max) {
      throw new BadRequestError(`Your plan allows up to ${max} active strateg${max === 1 ? 'y' : 'ies'}.`);
    }
  }

  const patch = toSnakePatch(args);
  if (Object.keys(patch).length > 0) {
    const { error } = await getSupabaseServer().from('bot_settings').update(patch).eq('id', settings._id);
    if (error) throw new Error(error.message);
  }

  const updated = await getSettingsRow(clerkId);
  if (!updated) throw new NotFoundError('Bot settings not found after update');
  return updated;
}

export async function setBotMode(clerkId: string, mode: 'DISABLED' | 'PAPER' | 'LIVE'): Promise<BotSettingsRecord> {
  const user = await me(clerkId);
  const isBypassRole = user?.role === 'ADMIN' || user?.role === 'DEVELOPER';

  if (mode === 'LIVE' && !isBypassRole) {
    const sub = await getSubscriptionByClerkId(clerkId);
    if (!hasLiveTradingAccess(user?.role ?? 'USER', sub, user?.email, user?.founderPlanOverride)) {
      throw new BadRequestError(
        isBillingEnabled()
          ? 'Live trading requires an active paid subscription.'
          : 'Live trading is not available yet.',
      );
    }
    const liveCred = await getCredentialByPaper(clerkId, false);
    if (!liveCred) throw new BadRequestError('Connect live Alpaca API keys before enabling LIVE mode.');
  }

  let settings = await getSettingsRow(clerkId);
  if (!settings) {
    await getSupabaseServer().from('bot_settings').insert({
      clerk_id: clerkId,
      mode,
      risk_level: DEFAULT_BOT_SETTINGS.riskLevel,
      max_active_trades: DEFAULT_BOT_SETTINGS.maxActiveTrades,
      max_trade_size: DEFAULT_BOT_SETTINGS.maxTradeSize,
      risk_per_trade_pct: DEFAULT_BOT_SETTINGS.riskPerTradePct,
      default_stop_pct: DEFAULT_BOT_SETTINGS.defaultStopPct,
      default_take_profit_pct: DEFAULT_BOT_SETTINGS.defaultTakeProfitPct,
      max_daily_loss: DEFAULT_BOT_SETTINGS.maxDailyLoss,
      trading_hours_start: DEFAULT_BOT_SETTINGS.tradingHoursStart,
      trading_hours_end: DEFAULT_BOT_SETTINGS.tradingHoursEnd,
      min_confidence: DEFAULT_BOT_SETTINGS.minConfidence,
      timeframes: DEFAULT_BOT_SETTINGS.timeframes,
      strategies: DEFAULT_BOT_SETTINGS.strategies,
      stock_strategies: DEFAULT_BOT_SETTINGS.stockStrategies,
      crypto_strategies: DEFAULT_BOT_SETTINGS.cryptoStrategies,
      include_experimental: DEFAULT_BOT_SETTINGS.includeExperimental,
      disabled_strategies: DEFAULT_BOT_SETTINGS.disabledStrategies,
      scan_interval_seconds: DEFAULT_BOT_SETTINGS.scanIntervalSeconds,
    });
    settings = await getSettingsRow(clerkId);
    if (!settings) throw new Error('Failed to create bot settings');
    return settings;
  }

  const { error } = await getSupabaseServer().from('bot_settings').update({ mode }).eq('id', settings._id);
  if (error) throw new Error(error.message);
  const updated = await getSettingsRow(clerkId);
  if (!updated) throw new NotFoundError('Bot settings not found after update');
  return updated;
}

export async function switchPreset(
  clerkId: string,
  args: {
    presetId: string;
    stockStrategies: string[];
    cryptoStrategies: string[];
    includeExperimental: boolean;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    minConfidence?: number;
  },
): Promise<BotSettingsRecord> {
  const user = await me(clerkId);
  const sub = await getSubscriptionByClerkId(clerkId);
  const role = user?.role ?? 'USER';
  const isBypassRole = role === 'ADMIN' || role === 'DEVELOPER';

  if (args.includeExperimental && !isBypassRole && !canUseExperimentalStrategies(role, sub, user?.email, user?.founderPlanOverride)) {
    throw new BadRequestError('Experimental strategies require Unlimited.');
  }
  if (args.cryptoStrategies.length > 0 && !isBypassRole) {
    const limits = getPlanLimits(role, sub, user?.email, user?.founderPlanOverride);
    if (!limits?.crypto) throw new BadRequestError('Crypto strategies require Pro or Unlimited.');
  }
  const limits = getPlanLimits(role, sub, user?.email, user?.founderPlanOverride);
  const maxStrategies = limits?.maxActiveStrategies;
  const activeCount = countActiveStrategies(args.stockStrategies, args.cryptoStrategies);
  if (maxStrategies != null && activeCount > maxStrategies) {
    throw new BadRequestError(`Your plan allows up to ${maxStrategies} active strateg${maxStrategies === 1 ? 'y' : 'ies'}.`);
  }

  const settings = await getSettingsRow(clerkId);
  if (!settings) throw new NotFoundError('Bot settings not found');

  const weekStart = startOfUtcWeekMs();
  const sameWeek = settings.presetWeekStartedAt === weekStart;
  const used = sameWeek ? settings.presetSwitchesThisWeek ?? 0 : 0;
  const maxSwitches = maxPresetSwitchesPerWeek(role, sub, user?.email, user?.founderPlanOverride);
  if (!isBypassRole && maxSwitches != null && used >= maxSwitches) {
    throw new BadRequestError(`You've used all ${maxSwitches} preset switch${maxSwitches === 1 ? '' : 'es'} this week. Upgrade for more.`);
  }

  const patch: Record<string, unknown> = {
    stock_strategies: args.stockStrategies,
    crypto_strategies: args.cryptoStrategies,
    include_experimental: args.includeExperimental,
    preset_switches_this_week: used + 1,
    preset_week_started_at: weekStart,
  };
  if (args.riskLevel !== undefined) patch.risk_level = args.riskLevel;
  if (args.minConfidence !== undefined) patch.min_confidence = args.minConfidence;

  const { error } = await getSupabaseServer().from('bot_settings').update(patch).eq('id', settings._id);
  if (error) throw new Error(error.message);
  const updated = await getSettingsRow(clerkId);
  if (!updated) throw new NotFoundError('Bot settings not found after preset switch');
  return updated;
}

export async function getBotStatus(clerkId: string) {
  const sb = getSupabaseServer();
  const [settings, paperRes, openRes, paperUsed, user, sub] = await Promise.all([
    getSettingsRow(clerkId),
    sb.from('paper_accounts').select('balance, equity').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('trades').select('id', { count: 'exact', head: true }).eq('clerk_id', clerkId).eq('result', 'OPEN'),
    countPaperTrades(clerkId),
    me(clerkId),
    getSubscriptionByClerkId(clerkId),
  ]);
  const role = user?.role ?? 'USER';
  const mode = settings?.mode ?? 'DISABLED';
  return {
    mode,
    running: mode === 'PAPER' || mode === 'LIVE',
    openTrades: openRes.count ?? 0,
    paperAccount: paperRes.data
      ? { balance: paperRes.data.balance as number, equity: paperRes.data.equity as number }
      : null,
    paperTradesUsed: paperUsed,
    paperTradesLimit: paperTradesLimitForUser(role, sub, user?.email, user?.founderPlanOverride ?? null),
    canUsePaperTrading: canUsePaperTrading(role, sub, paperUsed, user?.email, user?.founderPlanOverride),
    entitled: isLiveEntitled(role, sub, user?.email, user?.founderPlanOverride),
    scanIntervalSeconds: normalizeScanInterval(settings?.scanIntervalSeconds),
  };
}
