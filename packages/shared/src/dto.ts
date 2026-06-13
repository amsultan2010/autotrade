/**
 * Data Transfer Objects shared between backend and desktop client.
 * These describe the JSON shapes crossing the network boundary.
 */
import type {
  ExecutionMode,
  MistakeTag,
  RiskLevel,
  Role,
  StrategyId,
  SubscriptionStatus,
  Timeframe,
  TradeAction,
  TradeResult,
  TradeSide,
  UserStatus,
} from './enums.js';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface AuthTokens {
  accessToken: string;
  /** Refresh token is delivered separately; desktop stores it OS-encrypted. */
  refreshToken: string;
  expiresInSec: number;
}

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  tier: string | null;
  currentPeriodEnd: string | null; // ISO
  /** True if user may use gated features (active sub OR admin/dev role). */
  entitled: boolean;
}

export interface Candle {
  t: number; // epoch ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Quote {
  symbol: string;
  price: number;
  t: number;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  mic: string | null;
}

/** A single multi-timeframe analysis snapshot for one symbol. */
export interface IndicatorSnapshot {
  timeframe: Timeframe;
  price: number;
  ema9: number;
  ema21: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  macd: { macd: number; signal: number; histogram: number };
  atr14: number;
  support: number | null;
  resistance: number | null;
  volume: number;
  avgVolume: number;
}

/** Output of the decision engine (req #9). */
export interface TradeSignal {
  ticker: string;
  exchange: string;
  price: number;
  timeframe: Timeframe;
  strategy: StrategyId;
  action: TradeAction;
  confidence: number; // 0–100, already learning-weighted
  riskLevel: RiskLevel;
  entryReason: string;
  stopLoss: number | null;
  takeProfit: number | null;
  rrRatio: number | null;
  explanation: string;
  createdAt: string; // ISO
}

export interface TradeDTO {
  id: string;
  symbol: string;
  exchange: string;
  side: TradeSide;
  mode: ExecutionMode;
  qty: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number | null;
  result: TradeResult;
  strategy: StrategyId;
  confidence: number;
  entryReason: string;
  exitReason: string | null;
  mistakeTags: MistakeTag[];
  reasoningCorrect: boolean | null;
  openedAt: string;
  closedAt: string | null;
}

export interface PerformanceSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  openTrades: number;
  bestTrade: number | null;
  worstTrade: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  maxDrawdown: number;
}

/** User-configurable bot + risk controls (req #14). */
export interface BotSettingsDTO {
  mode: ExecutionMode;
  riskLevel: RiskLevel;
  maxActiveTrades: number;
  maxTradeSize: number;
  riskPerTradePct: number;
  defaultStopPct: number;
  defaultTakeProfitPct: number;
  maxDailyLoss: number;
  tradingHoursStart: string; // "09:30"
  tradingHoursEnd: string; // "16:00"
  minConfidence: number; // 0–100
  timeframes: Timeframe[];
  strategies: StrategyId[];
}
