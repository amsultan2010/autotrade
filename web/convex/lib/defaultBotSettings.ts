import type { Doc } from '../_generated/dataModel';

/** Default bot settings seeded for every new user. */
export const DEFAULT_BOT_SETTINGS: Omit<Doc<'botSettings'>, '_id' | '_creationTime' | 'clerkId'> = {
  mode: 'PAPER',
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
  strategies: [],
  stockStrategies: [
    'trend_following_v2',
    'momentum_v2',
    'mean_reversion_v2',
    'breakout_v1',
    'pullback_in_trend_v1',
    'vwap_intraday_v1',
    'stat_arb_pairs_v1',
  ],
  cryptoStrategies: [
    'crypto_trend_following',
    'crypto_momentum',
    'crypto_mean_reversion',
    'crypto_breakout',
  ],
  includeExperimental: false,
  disabledStrategies: [],
};
