import { PAPER_STARTING_BALANCE } from '@autotrade/shared';
import { getSupabaseServer } from '@/lib/supabase-server';
import { DEFAULT_BOT_SETTINGS } from '@/lib/defaultBotSettings';
import { FOUNDER_TIER, isFounderEmail } from '@/lib/billing';
import { dedupeSubscriptionsForClerk, ensureSubscriptionRecord, getSubscriptionByClerkId } from './subscriptions';

const DEFAULT_WATCHLIST: Array<{ symbol: string; exchange: string }> = [
  { symbol: 'AAPL', exchange: 'US' },
  { symbol: 'MSFT', exchange: 'US' },
  { symbol: 'NVDA', exchange: 'US' },
  { symbol: 'SPY', exchange: 'US' },
  { symbol: 'QQQ', exchange: 'US' },
  { symbol: 'BTC/USD', exchange: 'CRYPTO' },
];

async function seedDefaultWatchlist(clerkId: string): Promise<void> {
  const sb = getSupabaseServer();
  const { data: existing } = await sb
    .from('watched_symbols')
    .select('id')
    .eq('clerk_id', clerkId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const now = Date.now();
  await sb.from('watched_symbols').insert(
    DEFAULT_WATCHLIST.map((item) => ({
      clerk_id: clerkId,
      symbol: item.symbol,
      exchange: item.exchange,
      added_at: now,
    })),
  );
}

async function ensureFounderSubscription(clerkId: string, email: string): Promise<void> {
  if (!isFounderEmail(email)) return;
  await ensureSubscriptionRecord(clerkId, { status: 'ACTIVE', tier: FOUNDER_TIER });
}

/** Ensure paper account, bot settings, and subscription exist for a clerk user. */
export async function ensureUserRecords(clerkId: string, email: string): Promise<void> {
  const sb = getSupabaseServer();

  const [paperRes, botRes, sub] = await Promise.all([
    sb.from('paper_accounts').select('id').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('bot_settings').select('id').eq('clerk_id', clerkId).maybeSingle(),
    getSubscriptionByClerkId(clerkId),
  ]);

  if (!paperRes.data) {
    await sb.from('paper_accounts').insert({
      clerk_id: clerkId,
      balance: PAPER_STARTING_BALANCE,
      equity: PAPER_STARTING_BALANCE,
    });
  }

  if (!botRes.data) {
    await sb.from('bot_settings').insert({
      clerk_id: clerkId,
      ...{
        mode: DEFAULT_BOT_SETTINGS.mode,
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
      },
    });
  }

  if (!sub) {
    await ensureSubscriptionRecord(clerkId);
  } else {
    await dedupeSubscriptionsForClerk(clerkId, sub._id);
  }

  await seedDefaultWatchlist(clerkId);
  await ensureFounderSubscription(clerkId, email);
}
