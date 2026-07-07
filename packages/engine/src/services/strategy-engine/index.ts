/**
 * Strategy Engine — public API.
 *
 * Typical usage (mirrors how the existing scanLoop already fetches analysis):
 *
 *   import { strategyEngine } from '@autotrade/engine';
 *   const analysis = await analyzeSymbol(symbol, settings.timeframes);
 *   const { decision, log } = strategyEngine.runStrategyEngine({
 *     symbol, exchange, analysis,
 *     config: { mode: 'balanced' },
 *     account: { equity, openTradeCount, realizedPnlToday },
 *     riskSettings,           // the same RiskSettings the legacy engine uses
 *     riskLevel: settings.riskLevel,
 *   });
 *   if (decision.action === 'BUY' || decision.action === 'SHORT') {
 *     // hand decision.riskPlan to the existing execution engine
 *   }
 *   persist(log); // every decision is logged, traded or not
 *
 * This engine is ADDITIVE — it does not modify or replace the original
 * decision/risk engines. The originals are available as legacy strategies.
 */
import type { RiskLevel, Timeframe } from '@autotrade/shared';
import type { MultiTimeframeAnalysis } from '../analysis/index';
import { detectRegime } from './regime';
import { detectCryptoRegime } from './crypto/regimes';
import { resolveConfig, DEFAULT_STRATEGY_ENGINE_CONFIG, type StrategyEngineConfig } from './config';
import { strategiesForConfig } from './registry';
import { selectStrategy } from './selector';
import { buildDecisionLog, type DecisionLog } from './logging';
import type {
  AccountState,
  AnyRegime,
  CryptoContext,
  LiquidityContext,
  MarketContext,
  NewsContext,
  PairContext,
  StrategyContext,
  StrategyDecision,
} from './types';
import type { RiskSettings } from './risk';

// ── Re-export the whole engine surface. ──
export * from './types';
export * from './helpers';
export * from './regime';
export * from './risk';
export * from './config';
export * from './selector';
export * from './logging';
export * from './backtest';
export * from './registry';
export * from './strategies/legacy';
export * from './catalog';
export * from './crypto/index';

const BIAS_ORDER: Timeframe[] = ['1d', '1h', '15m', '5m', '1m'];
const ENTRY_ORDER: Timeframe[] = ['15m', '5m', '1m', '1h', '1d'];

function pickTf(order: Timeframe[], available: Timeframe[]): Timeframe | null {
  for (const tf of order) if (available.includes(tf)) return tf;
  return null;
}

export interface RunStrategyEngineInput {
  symbol: string;
  exchange: string;
  analysis: MultiTimeframeAnalysis;
  /** Defaults to a safe balanced config. */
  config?: StrategyEngineConfig;
  account: AccountState;
  riskSettings: RiskSettings;
  riskLevel: RiskLevel;
  intraday?: boolean;
  // Optional external data — strategies that need it abstain if it's absent.
  market?: MarketContext;
  news?: NewsContext;
  liquidity?: LiquidityContext;
  pair?: PairContext;
  crypto?: CryptoContext; // BTC/ETH trend, funding, OI, on-chain, order book
  vwap?: number | null;
  defaultStopPct?: number;
  defaultTakeProfitPct?: number;
}

export interface RunStrategyEngineResult {
  decision: StrategyDecision;
  log: DecisionLog;
  regime: AnyRegime;
  context: StrategyContext;
}

/**
 * One-call entry point: detect the regime, build the context, select a strategy,
 * and produce a decision + a structured log. Pure and side-effect free — the
 * caller decides whether/how to execute and persist.
 */
export function runStrategyEngine(input: RunStrategyEngineInput): RunStrategyEngineResult {
  const resolved = resolveConfig(input.config ?? DEFAULT_STRATEGY_ENGINE_CONFIG);
  const available = Object.keys(input.analysis) as Timeframe[];
  const biasTf = pickTf(BIAS_ORDER, available) ?? available[0] ?? '1d';
  const entryTf = pickTf(ENTRY_ORDER, available) ?? available[0] ?? '1d';
  const isCrypto = input.symbol.includes('/');

  // Crypto assets get crypto regimes (BTC-led, liquidation-risk, etc.); stocks
  // get the equity regime set. The matching detector runs before strategies.
  const regime: AnyRegime = isCrypto
    ? detectCryptoRegime({
        analysis: input.analysis,
        biasTf,
        entryTf,
        crypto: input.crypto,
        liquidity: input.liquidity,
        news: input.news,
      }).regime
    : detectRegime({
        analysis: input.analysis,
        biasTf,
        entryTf,
        isCrypto,
        market: input.market,
        news: input.news,
        liquidity: input.liquidity,
      }).regime;

  const context: StrategyContext = {
    symbol: input.symbol,
    exchange: input.exchange,
    isCrypto,
    intraday: input.intraday ?? false,
    analysis: input.analysis,
    biasTf,
    entryTf,
    regime,
    assetType: isCrypto ? 'crypto_spot' : 'stock',
    riskLevel: input.riskLevel,
    minConfidence: resolved.minConfidence,
    highRiskModeEnabled: resolved.highRiskMode,
    defaultStopPct: input.defaultStopPct,
    defaultTakeProfitPct: input.defaultTakeProfitPct,
    market: input.market,
    news: input.news,
    liquidity: input.liquidity,
    pair: input.pair,
    crypto: input.crypto,
    vwap: input.vwap,
  };

  const decision = selectStrategy(context, {
    strategies: strategiesForConfig(resolved),
    account: input.account,
    riskSettings: input.riskSettings,
    thresholds: resolved.thresholds,
    mode: resolved.mode,
    manualStrategy: resolved.manualStrategy,
    agreementBonusPerStrategy: resolved.agreementBonusPerStrategy,
  });

  return { decision, log: buildDecisionLog(decision, context), regime, context };
}
