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
  strategies: ['TrendBreakout', 'PullbackContinuation', 'MeanReversion', 'CryptoMomentum'],
};
