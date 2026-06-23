/**
 * Decision logging format.
 *
 * Every decision — traded or not — produces a structured DecisionLog so the
 * whole funnel is auditable: timestamp, market snapshot, regime, chosen
 * strategy, confidence, reasoning, stop/target, and (later) the outcome. Persist
 * these to your `signals`/`auditLogs` tables; the `outcome` is filled in when the
 * resulting trade closes.
 */
import type { IndicatorSnapshot } from '@autotrade/shared';
import type { StrategyContext, StrategyDecision } from './types';

export interface DecisionLog {
  timestamp: string;
  symbol: string;
  exchange: string;
  price: number;
  regime: string;
  action: string;
  chosenStrategy: string | null; // display name
  chosenStrategyInternal: string | null;
  source: string | null; // legacy | new | experimental
  confidence: number;
  stopLoss: number | null;
  takeProfit: number | null;
  rrRatio: number | null;
  qty: number | null;
  riskAmount: number | null;
  reasoning: string;
  blocked: boolean;
  blockReasons: string[];
  agreement: string[];
  rejected: Array<{ strategy: string; score: number; reason: string }>;
  marketSnapshot: IndicatorSnapshot | null;
  /** Filled in when the resulting trade closes (or left undefined for NO_TRADE). */
  outcome?: {
    result: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
    exitPrice?: number;
    pnl?: number;
    closedAt?: string;
  };
}

export function buildDecisionLog(decision: StrategyDecision, ctx: StrategyContext): DecisionLog {
  const snapshot = ctx.analysis[ctx.entryTf]?.snapshot ?? null;
  return {
    timestamp: decision.timestamp,
    symbol: decision.symbol,
    exchange: decision.exchange,
    price: decision.price,
    regime: decision.regime,
    action: decision.action,
    chosenStrategy: decision.chosenStrategy?.displayName ?? null,
    chosenStrategyInternal: decision.chosenStrategy?.internalName ?? null,
    source: decision.chosenStrategy?.source ?? null,
    confidence: decision.confidence,
    stopLoss: decision.riskPlan?.stopLoss ?? null,
    takeProfit: decision.riskPlan?.takeProfit ?? null,
    rrRatio: decision.riskPlan?.rrRatio ?? null,
    qty: decision.riskPlan?.qty ?? null,
    riskAmount: decision.riskPlan?.riskAmount ?? null,
    reasoning: decision.reasoning,
    blocked: decision.blocked,
    blockReasons: decision.blockReasons,
    agreement: decision.agreement,
    rejected: decision.rejected.map((r) => ({ strategy: r.displayName, score: r.score, reason: r.reason })),
    marketSnapshot: snapshot,
  };
}

/** One-line human summary for console/file logs. */
export function formatDecisionLogLine(log: DecisionLog): string {
  const head = `[${log.timestamp}] ${log.symbol} ${log.action}`;
  if (log.action === 'BUY' || log.action === 'SELL' || log.action === 'SHORT') {
    return (
      `${head} via ${log.chosenStrategy} (${log.source}, ${log.confidence}%) ` +
      `@ ${log.price.toFixed(2)} stop ${log.stopLoss?.toFixed(2)} tgt ${log.takeProfit?.toFixed(2)} ` +
      `R:R ${log.rrRatio} qty ${log.qty} — ${log.regime}`
    );
  }
  const why = log.blocked ? log.blockReasons.join('; ') : log.reasoning;
  return `${head} — ${log.regime} — ${why}`;
}
