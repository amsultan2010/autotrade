/**
 * Strategy Engine — shared types.
 *
 * This is a NEW, modular decision layer that sits ALONGSIDE the original
 * `services/decision` + `services/risk` engines. It does not replace or modify
 * them — the originals are wrapped as `source: 'legacy'` strategies (see
 * strategies/legacy.ts) so the bot can still choose them when they score best.
 *
 * Design goals (explicitly NOT "guarantee profit"):
 *   - Give the bot structured, comparable decision options.
 *   - Reject bad/unsafe trades often and explain why.
 *   - Make every decision auditable in plain English.
 *   - Make adding a new strategy a single new file in strategies/ + one line in
 *     registry.ts.
 *
 * Nothing here touches a database, the network, or money — it is pure compute,
 * which keeps the engine package portable and easy to unit-test / backtest.
 */
import type { RiskLevel, TradeSide, Timeframe } from '@autotrade/shared';
import type { MultiTimeframeAnalysis } from '../analysis/index';

// ─────────────────────────── Market regimes ───────────────────────────
// The bot identifies the regime FIRST, then only strategies suited to that
// regime compete. This is the single biggest "reject bad trades" lever.
export const MARKET_REGIMES = [
  'STRONG_UPTREND',
  'STRONG_DOWNTREND',
  'RANGING', // sideways
  'HIGH_VOLATILITY',
  'LOW_VOLATILITY',
  'NEWS_EVENT', // news/event-driven
  'BREAKOUT_SETUP',
  'LOW_LIQUIDITY', // unsafe to trade
  'RISK_OFF', // market-wide risk-off
  'CONFLICTING', // signals disagree → default no-trade
] as const;
export type MarketRegime = (typeof MARKET_REGIMES)[number];

// ─────────────────────────── Strategy taxonomy ───────────────────────────
/** Where a strategy came from. Lets the UI/selector treat them differently. */
export type StrategySource = 'legacy' | 'new' | 'experimental';

/** The final action the selector can emit. */
export const STRATEGY_ACTIONS = ['BUY', 'SELL', 'SHORT', 'HOLD', 'EXIT', 'NO_TRADE'] as const;
export type StrategyAction = (typeof STRATEGY_ACTIONS)[number];

/** User-selectable operating modes (see config.ts for the presets). */
export const TRADING_MODES = [
  'conservative',
  'balanced',
  'aggressive',
  'paper_only',
  'strategy_specific', // user pins one strategy
  'auto', // bot chooses
] as const;
export type TradingMode = (typeof TRADING_MODES)[number];

// ─────────────────────────── Optional external data ───────────────────────────
// Strategies that need data the core engine doesn't yet provide (news,
// sentiment, pairs, index context) declare it in `requiredInputs` and ABSTAIN
// safely (applicable:false) when it's missing — they never fabricate signals.

/** Index/breadth/volatility context for regime + risk-on/off decisions. */
export interface MarketContext {
  spyTrend?: 'UP' | 'DOWN' | 'FLAT';
  qqqTrend?: 'UP' | 'DOWN' | 'FLAT';
  vix?: number; // volatility index level, if available
  vixChangePct?: number; // day-over-day VIX move, if available
  breadthPct?: number; // % of names advancing, 0–100
  riskOff?: boolean; // precomputed risk-off flag if the caller has one
}

export interface NewsItem {
  headline: string;
  sentiment: number; // -1 (very negative) … +1 (very positive)
  publishedAt: number; // epoch ms
  source?: string;
  type?: 'earnings' | 'analyst' | 'sec' | 'product' | 'lawsuit' | 'macro' | 'other';
}

export interface NewsContext {
  items: NewsItem[];
  /** Hours until the next scheduled earnings, if known (null = none soon/unknown). */
  earningsWithinHours?: number | null;
  /** Volume abnormally high vs. average (often news-driven). */
  abnormalVolume?: boolean;
}

/** Tradeability / microstructure inputs used by liquidity + VWAP strategies. */
export interface LiquidityContext {
  spreadPct?: number; // bid/ask spread as % of price
  relativeVolume?: number; // today's volume / average (1.0 = normal)
  avgDollarVolume?: number; // $ traded per day — a liquidity floor
}

/** Inputs for the statistical-arbitrage / pairs strategy. */
export interface PairContext {
  partnerSymbol: string;
  correlation: number; // -1 … +1 over the lookback
  spreadZScore: number; // z-score of the current spread vs its mean
  partnerLiquid: boolean;
  cointegrated?: boolean; // optional, if a cointegration test was run
}

// ─────────────────────────── Strategy context ───────────────────────────
/**
 * Everything a strategy needs to make a call. Built once per symbol per cycle
 * by the selector. `regime` is detected BEFORE strategies run.
 */
export interface StrategyContext {
  symbol: string;
  exchange: string;
  isCrypto: boolean;
  /** True when the caller is running an intraday cycle (enables VWAP etc.). */
  intraday: boolean;

  analysis: MultiTimeframeAnalysis;
  biasTf: Timeframe; // higher timeframe for trend bias
  entryTf: Timeframe; // lower timeframe for the entry trigger
  regime: MarketRegime;

  // User risk knobs (mirrored from BotSettings / resolved config).
  riskLevel: RiskLevel;
  minConfidence: number; // 0–100
  highRiskModeEnabled: boolean; // allow trading in extreme volatility
  /** Default stop/target percents (drive the legacy decision engine's R:R). */
  defaultStopPct?: number; // default 2.0
  defaultTakeProfitPct?: number; // default 4.0

  // Optional external data (see contexts above). Absent → dependent strategies abstain.
  market?: MarketContext;
  news?: NewsContext;
  liquidity?: LiquidityContext;
  pair?: PairContext;
  vwap?: number | null; // session VWAP, if the caller computed it
}

// ─────────────────────────── Strategy output ───────────────────────────
/** What a single strategy returns from evaluate(). */
export interface StrategyEvaluation {
  /** Did this strategy's setup/data conditions apply at all this cycle? */
  applicable: boolean;
  /** Direction, or null for HOLD/abstain. */
  side: TradeSide | null;
  /** Raw strength 0–100 (the selector applies bonuses/penalties on top). */
  score: number;
  /** Plain-English reads that fired (for the explanation). */
  reasons: string[];
  /** Hard blockers this strategy detected (force NO_TRADE if it's chosen). */
  doNotTrade: string[];
  // Optional entry-plan hints; the RiskManager finalizes stop/size.
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * A strategy module. Add a new one by creating a file that exports an object
 * implementing this interface, then registering it in registry.ts.
 */
export interface Strategy {
  internalName: string; // machine id, e.g. 'trend_following_v2'
  displayName: string; // human label, e.g. 'Trend-Following Strategy'
  description: string;
  source: StrategySource; // 'legacy' | 'new' | 'experimental'
  /** Regimes this strategy is designed for. */
  bestRegimes: MarketRegime[];
  /** Regimes where it must stand down even if its pattern appears. */
  avoidRegimes?: MarketRegime[];
  requiredInputs: string[]; // human-readable data requirements
  indicators: string[]; // indicators/signals it uses
  /**
   * Overlay/master-filter strategies (e.g. risk-on/off) don't produce entries;
   * they can veto or scale the whole decision. The selector treats them apart.
   */
  overlay?: boolean;
  /** Compatibility flags so the selector/backtester can gate usage. */
  supports: { backtest: boolean; paper: boolean; live: boolean };
  evaluate(ctx: StrategyContext): StrategyEvaluation;
}

// ─────────────────────────── Selector output ───────────────────────────
export interface RejectedStrategy {
  internalName: string;
  displayName: string;
  source: StrategySource;
  score: number;
  reason: string;
}

export interface RiskPlan {
  qty: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number | null;
  riskAmount: number; // $ risked if stop hit
}

/** Account/runtime state the RiskManager needs to size + gate a trade. */
export interface AccountState {
  equity: number;
  openTradeCount: number;
  realizedPnlToday: number;
  nowMinutes?: number; // minutes since local midnight (trading-hours check)
}

/** Final, explainable decision for one symbol. */
export interface StrategyDecision {
  action: StrategyAction; // BUY | SELL | SHORT | HOLD | EXIT | NO_TRADE
  side: TradeSide | null;
  symbol: string;
  exchange: string;
  price: number;
  regime: MarketRegime;
  chosenStrategy: { internalName: string; displayName: string; source: StrategySource } | null;
  confidence: number; // 0–100 final (after agreement/conflict adjustments)
  reasoning: string; // plain-English summary
  agreement: string[]; // display names of strategies that agreed on the side
  rejected: RejectedStrategy[]; // why the others were not chosen
  riskPlan: RiskPlan | null; // null when NO_TRADE
  blocked: boolean; // true when a hard rule blocked an otherwise-valid setup
  blockReasons: string[];
  timestamp: string; // ISO
}
