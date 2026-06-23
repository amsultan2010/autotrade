/**
 * Legacy strategy adapters.
 *
 * IMPORTANT: these do NOT reimplement the original logic. They DELEGATE to the
 * untouched original code in `services/decision` so the bot's existing
 * strategies are preserved exactly and can still be chosen by the selector when
 * they score best. All are tagged `source: 'legacy'`.
 *
 *   - LegacyTrendStrategy        → original `TrendBreakout`
 *   - LegacyPullbackStrategy     → original `PullbackContinuation`
 *   - LegacyMeanReversionStrategy→ original `MeanReversion`
 *   - LegacyMomentumStrategy     → original `CryptoMomentum`
 *   - LegacyDecisionStrategy     → the WHOLE original `decide()` engine as one option
 *
 * (The original RiskManager is preserved separately as `LegacyRiskManager` in
 * ../risk.ts, delegating to the unchanged `evaluateRisk`.)
 */
import type { StrategyId, Timeframe } from '@autotrade/shared';
import {
  STRATEGY_FNS,
  type StrategyContext as LegacyCtx,
  type StrategyResult as LegacyResult,
} from '../../decision/strategies';
import { decide } from '../../decision/index';
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';

/** Build the original strategy context from the new one. */
function toLegacyCtx(ctx: StrategyContext): LegacyCtx {
  return {
    analysis: ctx.analysis,
    biasTf: ctx.biasTf,
    entryTf: ctx.entryTf,
    isCrypto: ctx.isCrypto,
  };
}

/** Map an original StrategyResult (or null) into the new StrategyEvaluation. */
function fromLegacyResult(res: LegacyResult | null): StrategyEvaluation {
  if (!res) {
    return { applicable: false, side: null, score: 0, reasons: [], doNotTrade: [] };
  }
  return {
    applicable: true,
    side: res.side,
    score: res.rawScore,
    reasons: res.reasons,
    doNotTrade: [],
  };
}

/** Wrap one entry from the original STRATEGY_FNS table. */
function wrapLegacyFn(
  id: StrategyId,
  meta: Pick<Strategy, 'internalName' | 'displayName' | 'description' | 'bestRegimes' | 'indicators' | 'requiredInputs'> &
    Partial<Pick<Strategy, 'avoidRegimes' | 'supports'>>,
): Strategy {
  return {
    source: 'legacy',
    supports: { backtest: true, paper: true, live: true },
    ...meta,
    evaluate: (ctx) => fromLegacyResult(STRATEGY_FNS[id](toLegacyCtx(ctx))),
  };
}

export const LegacyTrendStrategy = wrapLegacyFn('TrendBreakout', {
  internalName: 'legacy_trend_breakout',
  displayName: 'Legacy Trend-Breakout',
  description:
    'The original trend-breakout logic: established higher-timeframe trend plus a structural break on volume. Preserved unchanged from the first engine.',
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND', 'BREAKOUT_SETUP'],
  avoidRegimes: ['RANGING', 'LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['EMA9/EMA21/SMA50', 'ADX', 'MACD histogram', 'volume vs avg', 'support/resistance'],
  requiredInputs: ['Multi-timeframe candles'],
});

export const LegacyPullbackStrategy = wrapLegacyFn('PullbackContinuation', {
  internalName: 'legacy_pullback_continuation',
  displayName: 'Legacy Pullback-Continuation',
  description:
    'The original pullback-in-trend logic: trend intact, price pulled back to EMA21 with an RSI reset and a reversal candle. Preserved unchanged.',
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND'],
  avoidRegimes: ['RANGING', 'HIGH_VOLATILITY', 'LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['EMA21 pullback', 'RSI reset', 'engulfing candle'],
  requiredInputs: ['Multi-timeframe candles'],
});

export const LegacyMeanReversionStrategy = wrapLegacyFn('MeanReversion', {
  internalName: 'legacy_mean_reversion',
  displayName: 'Legacy Mean-Reversion',
  description:
    'The original mean-reversion logic: stretched RSI into support/resistance with a reversal candle, penalised in strong trends. Preserved unchanged.',
  bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
  avoidRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND', 'NEWS_EVENT', 'BREAKOUT_SETUP', 'LOW_LIQUIDITY'],
  indicators: ['RSI overbought/oversold', 'support/resistance', 'engulfing candle', 'ADX penalty'],
  requiredInputs: ['Entry-timeframe candles'],
});

export const LegacyMomentumStrategy = wrapLegacyFn('CryptoMomentum', {
  internalName: 'legacy_crypto_momentum',
  displayName: 'Legacy Momentum (crypto)',
  description:
    'The original crypto-tuned, long-only momentum logic: fast-timeframe breakouts and oversold snap-backs. Only fires for crypto symbols. Preserved unchanged.',
  bestRegimes: ['STRONG_UPTREND', 'HIGH_VOLATILITY', 'BREAKOUT_SETUP'],
  avoidRegimes: ['RISK_OFF', 'LOW_LIQUIDITY', 'CONFLICTING'],
  indicators: ['fast EMA stack', 'range-high break', 'volume surge', 'MACD', 'RSI momentum zone'],
  requiredInputs: ['Fast-timeframe candles', 'crypto symbol'],
});

/**
 * The entire original decision engine (`decide()`) exposed as a single
 * selectable strategy — runs all four legacy strategies with confluence and the
 * original ATR-based stop/target. This is the most faithful "use the old brain"
 * option.
 */
const ALL_LEGACY_IDS: StrategyId[] = [
  'TrendBreakout',
  'PullbackContinuation',
  'MeanReversion',
  'CryptoMomentum',
];

export const LegacyDecisionStrategy: Strategy = {
  internalName: 'legacy_decision_engine',
  displayName: 'Legacy Decision Engine',
  description:
    'Runs the original end-to-end decision engine (all legacy strategies + confluence + ATR stops) and exposes its verdict as one option. Lets the bot compare the original brain head-to-head with the new strategies.',
  source: 'legacy',
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND', 'RANGING', 'BREAKOUT_SETUP'],
  avoidRegimes: ['LOW_LIQUIDITY', 'RISK_OFF'],
  indicators: ['All legacy strategies combined', 'confluence bonus', 'ATR stop/target'],
  requiredInputs: ['Multi-timeframe candles'],
  supports: { backtest: true, paper: true, live: true },
  evaluate: (ctx: StrategyContext): StrategyEvaluation => {
    const timeframes = Object.keys(ctx.analysis) as Timeframe[];
    const signal = decide({
      symbol: ctx.symbol,
      exchange: ctx.exchange,
      analysis: ctx.analysis,
      timeframes,
      enabledStrategies: ALL_LEGACY_IDS,
      minConfidence: ctx.minConfidence,
      defaultStopPct: ctx.defaultStopPct ?? 2.0,
      defaultTakeProfitPct: ctx.defaultTakeProfitPct ?? 4.0,
      learningWeights: {},
    });

    const isEntry = signal.action === 'BUY' || signal.action === 'SELL';
    return {
      applicable: signal.confidence > 0 || isEntry,
      side: signal.action === 'BUY' ? 'LONG' : signal.action === 'SELL' ? 'SHORT' : null,
      score: signal.confidence,
      reasons: [signal.entryReason].filter(Boolean),
      doNotTrade: signal.action === 'AVOID' && signal.confidence > 0 ? [signal.explanation] : [],
      entryPrice: signal.price || undefined,
      stopLoss: signal.stopLoss ?? undefined,
      takeProfit: signal.takeProfit ?? undefined,
    };
  },
};

/** All legacy strategies, in a stable order. */
export const LEGACY_STRATEGIES: Strategy[] = [
  LegacyTrendStrategy,
  LegacyPullbackStrategy,
  LegacyMeanReversionStrategy,
  LegacyMomentumStrategy,
  LegacyDecisionStrategy,
];
