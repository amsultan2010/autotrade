/**
 * DecisionEngine — turns the multi-timeframe analysis into a single explained
 * TradeSignal (req #9). It:
 *   1. runs each enabled strategy,
 *   2. multiplies each raw score by the user's learned weight for that strategy
 *      (personalization, req #10),
 *   3. picks the strongest setup,
 *   4. derives ATR-based stop/target and risk/reward,
 *   5. emits BUY/SELL/HOLD/AVOID with a human-readable explanation.
 *
 * It never sizes positions or routes orders — that's Risk + Execution.
 */
import type {
  RiskLevel,
  StrategyId,
  Timeframe,
  TradeAction,
  TradeSignal,
} from '@alphabot/shared';
import type { MultiTimeframeAnalysis } from '../analysis/index.js';
import { STRATEGY_FNS, type StrategyResult } from './strategies.js';

export interface DecisionInput {
  symbol: string;
  exchange: string;
  analysis: MultiTimeframeAnalysis;
  timeframes: Timeframe[];
  enabledStrategies: StrategyId[];
  minConfidence: number;
  defaultStopPct: number;
  defaultTakeProfitPct: number;
  /** strategy id → learned multiplier (default 1.0). */
  learningWeights: Record<string, number>;
}

const BIAS_ORDER: Timeframe[] = ['1d', '1h', '15m', '5m', '1m'];
const ENTRY_ORDER: Timeframe[] = ['15m', '5m', '1m', '1h', '1d'];

function pick(order: Timeframe[], available: Timeframe[]): Timeframe | null {
  for (const tf of order) if (available.includes(tf)) return tf;
  return null;
}

function riskLevelFor(atrPct: number): RiskLevel {
  if (atrPct >= 4) return 'HIGH';
  if (atrPct >= 1.5) return 'MEDIUM';
  return 'LOW';
}

export function decide(input: DecisionInput): TradeSignal {
  const available = Object.keys(input.analysis) as Timeframe[];
  const biasTf = pick(BIAS_ORDER, available);
  const entryTf = pick(ENTRY_ORDER, available);

  const base = {
    ticker: input.symbol,
    exchange: input.exchange,
    createdAt: new Date().toISOString(),
  };

  if (!biasTf || !entryTf) {
    return {
      ...base,
      price: 0,
      timeframe: input.timeframes[0] ?? '1d',
      strategy: 'TrendBreakout',
      action: 'AVOID',
      confidence: 0,
      riskLevel: 'LOW',
      entryReason: 'Insufficient market data',
      stopLoss: null,
      takeProfit: null,
      rrRatio: null,
      explanation: 'Not enough candle history across timeframes to analyze this symbol.',
    };
  }

  const entry = input.analysis[entryTf]!;
  const price = entry.snapshot.price;
  const atr = entry.snapshot.atr14;
  const atrPct = price > 0 ? (atr / price) * 100 : 0;

  const isCrypto = input.symbol.includes('/');

  // Evaluate enabled strategies, apply learning weights, keep the best.
  // Crypto is long-only (no shorting spot), so only LONG setups compete.
  let best: { result: StrategyResult; weighted: number } | null = null;
  let sawCryptoShort = false;
  for (const id of input.enabledStrategies) {
    const fn = STRATEGY_FNS[id];
    if (!fn) continue;
    const res = fn({ analysis: input.analysis, biasTf, entryTf, isCrypto });
    if (!res) continue;
    if (isCrypto && res.side !== 'LONG') {
      sawCryptoShort = true;
      continue;
    }
    const weight = input.learningWeights[id] ?? 1.0;
    const weighted = Math.max(0, Math.min(100, res.rawScore * weight));
    if (!best || weighted > best.weighted) best = { result: res, weighted };
  }

  if (!best) {
    const avoidCrypto = isCrypto && sawCryptoShort;
    return {
      ...base,
      price,
      timeframe: entryTf,
      strategy: input.enabledStrategies[0] ?? 'TrendBreakout',
      action: avoidCrypto ? 'AVOID' : 'HOLD',
      confidence: 0,
      riskLevel: riskLevelFor(atrPct),
      entryReason: avoidCrypto ? 'Bearish crypto setup — long-only, staying out' : 'No strategy setup present',
      stopLoss: null,
      takeProfit: null,
      rrRatio: null,
      explanation: avoidCrypto
        ? `${input.symbol} is bearish and crypto can't be shorted — staying out.`
        : `No enabled strategy found a valid setup on ${input.symbol} right now.`,
    };
  }

  const { result, weighted } = best;
  const confidence = Math.round(weighted);

  // ATR-based stop, with a percent floor from user settings.
  const stopDistance = Math.max(atr * 1.5, price * (input.defaultStopPct / 100));
  const rr = input.defaultTakeProfitPct / input.defaultStopPct;
  const targetDistance = stopDistance * rr;

  const stopLoss = result.side === 'LONG' ? price - stopDistance : price + stopDistance;
  const takeProfit = result.side === 'LONG' ? price + targetDistance : price - targetDistance;
  const rrRatio = stopDistance > 0 ? Number((targetDistance / stopDistance).toFixed(2)) : null;

  // Below the user's confidence floor → surface as AVOID with the reasoning.
  const meetsThreshold = confidence >= input.minConfidence;
  const action: TradeAction = meetsThreshold ? (result.side === 'LONG' ? 'BUY' : 'SELL') : 'AVOID';

  const directionWord = result.side === 'LONG' ? 'long' : 'short';
  const explanation = meetsThreshold
    ? `${result.strategy} setup to go ${directionWord} ${input.symbol} at ~${price.toFixed(2)}. ` +
      `${result.reasons.join('; ')}. Stop ${stopLoss.toFixed(2)}, target ${takeProfit.toFixed(2)} ` +
      `(R:R ${rrRatio}). Confidence ${confidence}% after personalization.`
    : `${result.strategy} setup detected but confidence ${confidence}% is below your ` +
      `${input.minConfidence}% threshold — avoiding. ${result.reasons.join('; ')}.`;

  return {
    ...base,
    price,
    timeframe: entryTf,
    strategy: result.strategy,
    action,
    confidence,
    riskLevel: riskLevelFor(atrPct),
    entryReason: result.reasons.join('; '),
    stopLoss: Number(stopLoss.toFixed(2)),
    takeProfit: Number(takeProfit.toFixed(2)),
    rrRatio,
    explanation,
  };
}
