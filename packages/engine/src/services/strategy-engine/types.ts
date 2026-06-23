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

// ─────────────────────────── Crypto regimes ───────────────────────────
// Crypto trades differently from equities (24/7, BTC-led, leverage/liquidations),
// so crypto assets get their OWN regime set. The crypto regime is detected before
// crypto strategies run (see crypto/regimes.ts).
export const CRYPTO_REGIMES = [
  'BTC_LED_UPTREND',
  'BTC_LED_DOWNTREND',
  'ALTCOIN_ROTATION',
  'CRYPTO_RANGING',
  'CRYPTO_HIGH_VOL_BREAKOUT',
  'CRYPTO_LOW_LIQUIDITY', // unsafe to trade
  'CRYPTO_NEWS_DRIVEN',
  'CRYPTO_LEVERAGE_HEAVY',
  'CRYPTO_LIQUIDATION_RISK',
  'CRYPTO_CONFLICTING', // default no-trade
] as const;
export type CryptoRegime = (typeof CRYPTO_REGIMES)[number];

/** Either a stock or crypto regime — strategies declare which they suit. */
export type AnyRegime = MarketRegime | CryptoRegime;

/** Human labels for every regime (stock + crypto). Falls back to the raw id. */
export const REGIME_LABELS: Record<string, string> = {
  STRONG_UPTREND: 'Strong uptrend',
  STRONG_DOWNTREND: 'Strong downtrend',
  RANGING: 'Sideways / ranging',
  HIGH_VOLATILITY: 'High volatility',
  LOW_VOLATILITY: 'Low volatility',
  NEWS_EVENT: 'News / event-driven',
  BREAKOUT_SETUP: 'Breakout setup',
  LOW_LIQUIDITY: 'Low liquidity / unsafe',
  RISK_OFF: 'Market-wide risk-off',
  CONFLICTING: 'Conflicting signals / no-trade',
  BTC_LED_UPTREND: 'BTC-led uptrend',
  BTC_LED_DOWNTREND: 'BTC-led downtrend',
  ALTCOIN_ROTATION: 'Altcoin rotation',
  CRYPTO_RANGING: 'Crypto sideways / ranging',
  CRYPTO_HIGH_VOL_BREAKOUT: 'High-volatility breakout',
  CRYPTO_LOW_LIQUIDITY: 'Low-volume / unsafe liquidity',
  CRYPTO_NEWS_DRIVEN: 'News / narrative-driven',
  CRYPTO_LEVERAGE_HEAVY: 'Leverage-heavy market',
  CRYPTO_LIQUIDATION_RISK: 'Liquidation-risk market',
  CRYPTO_CONFLICTING: 'Conflicting signals / no-trade',
};
export function regimeLabel(r: AnyRegime): string {
  return REGIME_LABELS[r] ?? String(r);
}

// ─────────────────────────── Strategy taxonomy ───────────────────────────
/**
 * Where a strategy came from. `crypto_new` marks the crypto-specific set so the
 * UI/selector can group and filter them.
 */
export type StrategySource = 'legacy' | 'new' | 'experimental' | 'crypto_new';

/** What kind of asset a strategy is built to trade. */
export type AssetType = 'stock' | 'crypto_spot' | 'crypto_perp' | 'crypto_futures' | 'mixed';

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

/** Order-book / leverage / on-chain inputs used by the crypto strategies. */
export interface FundingContext {
  fundingRate?: number; // current funding (e.g. 0.0001 = 0.01%/8h)
  fundingChange?: number; // recent change in funding
  openInterest?: number; // total OI (contracts or notional)
  openInterestChangePct?: number; // recent % change in OI
  longShortRatio?: number; // >1 = crowded long, <1 = crowded short
  perpBasisPct?: number; // (perp - spot) / spot * 100
  liquidationRisk?: 'low' | 'medium' | 'high'; // precomputed if available
}

export interface OnChainContext {
  exchangeInflowUsd?: number; // coin flowing TO exchanges (sell pressure)
  exchangeOutflowUsd?: number; // coin leaving exchanges (accumulation)
  stablecoinInflowUsd?: number; // buying power arriving
  whaleNetFlowUsd?: number; // + = whales accumulating, - = distributing
  activeAddressesChangePct?: number;
}

export interface OrderBookContext {
  spreadPct?: number; // bid/ask spread %
  depthUsdNearTouch?: number; // $ resting within ~0.5% of mid
  slippageEstPct?: number; // estimated slippage for the intended size
  volume24hUsd?: number; // 24h $ volume
  relativeVolume?: number; // vs average
}

/**
 * Crypto-market context, supplied by the caller. The BTC/ETH trend fields drive
 * the market-leader filter; the rest power the funding / OI / on-chain
 * strategies, which ABSTAIN when their data is absent.
 */
export interface CryptoContext {
  btcTrend?: 'UP' | 'DOWN' | 'FLAT';
  ethTrend?: 'UP' | 'DOWN' | 'FLAT';
  btcDominanceTrend?: 'UP' | 'DOWN' | 'FLAT';
  ethBtcRatioTrend?: 'UP' | 'DOWN' | 'FLAT';
  totalMarketCapTrend?: 'UP' | 'DOWN' | 'FLAT';
  /** This coin's strength vs BTC over the lookback (-1 … +1). */
  strengthVsBtc?: number;
  funding?: FundingContext;
  onChain?: OnChainContext;
  orderBook?: OrderBookContext;
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
  /** Stock OR crypto regime — picked by the matching detector for this asset. */
  regime: AnyRegime;
  /** What kind of asset this is (default 'stock'; crypto assets set crypto_spot). */
  assetType: AssetType;

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
  crypto?: CryptoContext; // BTC/ETH trend, funding, OI, on-chain, order book
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
  trailingStop?: number; // distance or price for a trailing stop, if the strategy sets one
  entrySignal?: string; // short description of the trigger (for the log)
  exitSignal?: string; // short description of how it plans to exit
  dataUsed?: string[]; // which data sources fed this read
}

/**
 * A strategy module. Add a new one by creating a file that exports an object
 * implementing this interface, then registering it in registry.ts.
 */
export interface Strategy {
  internalName: string; // machine id, e.g. 'trend_following_v2'
  displayName: string; // human label, e.g. 'Trend-Following Strategy'
  description: string;
  source: StrategySource; // 'legacy' | 'new' | 'experimental' | 'crypto_new'
  /** What asset class this strategy trades. Crypto ones self-gate to crypto. */
  assetType?: AssetType; // default 'stock'
  /** Regimes this strategy is designed for (stock or crypto). */
  bestRegimes: AnyRegime[];
  /** Regimes where it must stand down even if its pattern appears. */
  avoidRegimes?: AnyRegime[];
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

/** A trailing-stop plan attached to an approved decision, if the strategy set one. */
export interface TrailPlan {
  trailingStop: number;
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
  directionBias: 'bullish' | 'bearish' | 'neutral'; // human-readable direction
  symbol: string;
  exchange: string;
  assetType: AssetType;
  price: number;
  regime: AnyRegime;
  chosenStrategy:
    | { internalName: string; displayName: string; source: StrategySource; assetType: AssetType }
    | null;
  confidence: number; // 0–100 final (after agreement/conflict adjustments)
  reasoning: string; // plain-English summary
  entrySignal?: string;
  exitSignal?: string;
  dataUsed?: string[];
  agreement: string[]; // display names of strategies that agreed on the side
  rejected: RejectedStrategy[]; // why the others were not chosen
  riskPlan: RiskPlan | null; // null when NO_TRADE
  trailingStop?: number | null;
  blocked: boolean; // true when a hard rule blocked an otherwise-valid setup
  blockReasons: string[];
  timestamp: string; // ISO
}
