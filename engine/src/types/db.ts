/** Convex-backed record shapes for the engine. */

export type BotMode = 'DISABLED' | 'PAPER' | 'LIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type TradeSide = 'LONG' | 'SHORT';
export type TradeResult = 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
export type UserRole = 'USER' | 'ADMIN' | 'DEVELOPER';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
export type SignalAction = 'BUY' | 'SELL' | 'HOLD' | 'AVOID' | 'CLOSE';

export interface BotSettingsRecord {
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
}

export interface TradeRecord {
  _id: string;
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

export interface BotContextRecord {
  role: UserRole;
  status: UserStatus;
  botSettings: BotSettingsRecord | null;
  watchlist: Array<{ symbol: string; exchange: string; mic?: string }>;
  paperAccount: { balance: number; equity: number } | null;
  subscription: { status: SubscriptionStatus; tier?: string; currentPeriodEnd?: number } | null;
  liveEntitled: boolean;
}

export interface DigestTradeRecord {
  symbol: string;
  pnl: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
}

export interface ActiveBotUserRecord {
  clerkId: string;
  symbols: string[];
}

export interface ActiveUserRecord {
  clerkId: string;
  email: string;
}

export interface DecryptedBrokerKeys {
  keyId: string;
  secret: string;
  paper: boolean;
  provider: string;
}
