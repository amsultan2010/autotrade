/**
 * Strategy Selector.
 *
 * The orchestration layer. Given a fully-built StrategyContext (regime already
 * detected), it:
 *   1. runs overlay/master-filter strategies first — they can VETO everything,
 *   2. evaluates every entry strategy suited to the current regime,
 *   3. scores them, applies an agreement bonus and a conflict block,
 *   4. picks the highest-scoring valid candidate,
 *   5. computes a stop/target and runs the RiskManager,
 *   6. returns a single explainable StrategyDecision.
 *
 * It is deliberately biased toward NOT trading: any veto, conflict, or failed
 * risk gate results in NO_TRADE with the reasons attached.
 */
import type { TradeSide } from '@autotrade/shared';
import { regimeLabel } from './regime';
import { assessRisk, type RiskSettings, type RiskThresholds } from './risk';
import type {
  AccountState,
  RejectedStrategy,
  Strategy,
  StrategyAction,
  StrategyContext,
  StrategyDecision,
  StrategyEvaluation,
  TradingMode,
} from './types';

export interface SelectOptions {
  strategies: Strategy[];
  account: AccountState;
  riskSettings: RiskSettings;
  thresholds?: RiskThresholds;
  mode: TradingMode;
  /** Required when mode === 'strategy_specific'. */
  manualStrategy?: string;
  agreementBonusPerStrategy?: number; // default 5
  maxAgreementBonus?: number; // default 15
  conflictThreshold?: number; // a candidate at/above this counts toward conflict (default 50)
  offRegimePenalty?: number; // score penalty when firing outside bestRegimes (default 15)
}

interface Candidate {
  strategy: Strategy;
  evaluation: StrategyEvaluation;
  adjustedScore: number;
  side: TradeSide;
}

function meta(s: Strategy) {
  return { internalName: s.internalName, displayName: s.displayName, source: s.source };
}

export function selectStrategy(ctx: StrategyContext, opts: SelectOptions): StrategyDecision {
  const timestamp = new Date().toISOString();
  const entry = ctx.analysis[ctx.entryTf];
  const price = entry?.snapshot.price ?? 0;
  const rejected: RejectedStrategy[] = [];

  const make = (over: Partial<StrategyDecision>): StrategyDecision => ({
    action: 'NO_TRADE',
    side: null,
    symbol: ctx.symbol,
    exchange: ctx.exchange,
    price,
    regime: ctx.regime,
    chosenStrategy: null,
    confidence: 0,
    reasoning: '',
    agreement: [],
    rejected,
    riskPlan: null,
    blocked: false,
    blockReasons: [],
    timestamp,
    ...over,
  });

  if (!entry || price <= 0) {
    return make({ action: 'NO_TRADE', reasoning: 'Insufficient market data to evaluate any strategy.' });
  }

  // ── 1) Overlays / master filters run first and can veto everything. ──
  const overlays = opts.strategies.filter((s) => s.overlay);
  let entryStrategies = opts.strategies.filter((s) => !s.overlay);
  if (opts.mode === 'strategy_specific' && opts.manualStrategy) {
    entryStrategies = entryStrategies.filter((s) => s.internalName === opts.manualStrategy);
  }

  const overlayVetoes: string[] = [];
  for (const ov of overlays) {
    const ev = ov.evaluate(ctx);
    for (const r of ev.doNotTrade) overlayVetoes.push(`${ov.displayName}: ${r}`);
  }
  if (overlayVetoes.length > 0) {
    return make({
      action: 'NO_TRADE',
      blocked: true,
      blockReasons: overlayVetoes,
      reasoning: `Master risk filter vetoed trading in the ${regimeLabel(ctx.regime)} regime — ${overlayVetoes.join('; ')}.`,
    });
  }

  // ── 2) Evaluate entry strategies. ──
  const candidates: Candidate[] = [];
  for (const strat of entryStrategies) {
    if (strat.avoidRegimes?.includes(ctx.regime)) {
      rejected.push({ ...meta(strat), score: 0, reason: `Not suited to the ${regimeLabel(ctx.regime)} regime` });
      continue;
    }
    const ev = strat.evaluate(ctx);
    if (!ev.applicable) {
      rejected.push({ ...meta(strat), score: ev.score, reason: ev.reasons[0] ?? 'No setup present' });
      continue;
    }
    if (ev.doNotTrade.length > 0) {
      rejected.push({ ...meta(strat), score: ev.score, reason: ev.doNotTrade[0]! });
      continue;
    }
    if (!ev.side || ev.score <= 0) {
      rejected.push({ ...meta(strat), score: ev.score, reason: ev.reasons[0] ?? 'No actionable direction' });
      continue;
    }
    // Allowed off-regime, but weaker.
    let adjustedScore = ev.score;
    if (!strat.bestRegimes.includes(ctx.regime)) {
      adjustedScore = Math.max(0, adjustedScore - (opts.offRegimePenalty ?? 15));
    }
    candidates.push({ strategy: strat, evaluation: ev, adjustedScore, side: ev.side });
  }

  // ── 3) Conflict block: strong signals both ways → stand down. ──
  const conflictTh = opts.conflictThreshold ?? 50;
  const strongLong = candidates.some((c) => c.side === 'LONG' && c.adjustedScore >= conflictTh);
  const strongShort = candidates.some((c) => c.side === 'SHORT' && c.adjustedScore >= conflictTh);
  if (strongLong && strongShort) {
    for (const c of candidates) {
      rejected.push({ ...meta(c.strategy), score: c.adjustedScore, reason: 'Blocked by conflicting signals' });
    }
    return make({
      action: 'NO_TRADE',
      blocked: true,
      blockReasons: ['Strong LONG and SHORT signals are in conflict'],
      reasoning: 'Multiple strategies disagree strongly on direction — standing down to avoid a coin-flip trade.',
    });
  }

  if (candidates.length === 0) {
    return make({
      action: 'HOLD',
      reasoning: `No strategy found a valid setup in the ${regimeLabel(ctx.regime)} regime right now.`,
    });
  }

  // ── 4) Pick the best, add an agreement bonus. ──
  candidates.sort((a, b) => b.adjustedScore - a.adjustedScore);
  const best = candidates[0]!;
  const agreeing = candidates.slice(1).filter((c) => c.side === best.side);
  const bonus = Math.min(
    opts.maxAgreementBonus ?? 15,
    agreeing.length * (opts.agreementBonusPerStrategy ?? 5),
  );
  const confidence = Math.min(100, Math.round(best.adjustedScore + bonus));

  // Everything not chosen → rejected list with a reason.
  for (const c of candidates.slice(1)) {
    rejected.push({
      ...meta(c.strategy),
      score: c.adjustedScore,
      reason:
        c.side === best.side
          ? `Agrees but scored lower than ${best.strategy.displayName}`
          : `Lower-scoring opposite view vs ${best.strategy.displayName}`,
    });
  }

  // ── 5) Stop / target: strategy hint, else ATR-based fallback. ──
  const atr = entry.snapshot.atr14;
  const stopPct = ctx.defaultStopPct ?? 2.0;
  const tpPct = ctx.defaultTakeProfitPct ?? 4.0;
  const stopDist = Math.max(atr * 1.5, (price * stopPct) / 100);
  const rrTarget = stopPct > 0 ? tpPct / stopPct : 2;
  const stopLoss =
    best.evaluation.stopLoss ?? (best.side === 'LONG' ? price - stopDist : price + stopDist);
  const takeProfit =
    best.evaluation.takeProfit ??
    (best.side === 'LONG' ? price + stopDist * rrTarget : price - stopDist * rrTarget);

  // ── 6) Risk gates + sizing (delegates final sizing to the legacy engine). ──
  const risk = assessRisk({
    ctx,
    side: best.side,
    entryPrice: price,
    stopLoss,
    takeProfit,
    confidence,
    account: opts.account,
    settings: opts.riskSettings,
    thresholds: opts.thresholds,
  });

  const agreementNames = [best.strategy.displayName, ...agreeing.map((c) => c.strategy.displayName)];

  if (!risk.ok) {
    return make({
      action: 'NO_TRADE',
      side: best.side,
      chosenStrategy: meta(best.strategy),
      confidence,
      blocked: true,
      blockReasons: risk.reasons,
      agreement: agreementNames,
      reasoning:
        `${best.strategy.displayName} signalled ${best.side} on ${ctx.symbol} ` +
        `(confidence ${confidence}%), but the trade was blocked: ${risk.reasons.join('; ')}.`,
    });
  }

  // ── 7) Approved. ──
  const action: StrategyAction = best.side === 'LONG' ? 'BUY' : 'SHORT';
  const confluenceNote =
    agreeing.length > 0 ? ` ${agreementNames.length} strategies agree (+${bonus}% confluence).` : '';
  const reasoning =
    `Regime: ${regimeLabel(ctx.regime)}. Chose ${best.strategy.displayName} ` +
    `(${best.strategy.source}) to go ${best.side} ${ctx.symbol} at ~${price.toFixed(2)}. ` +
    `${best.evaluation.reasons.join('; ')}. Stop ${risk.plan.stopLoss.toFixed(2)}, ` +
    `target ${risk.plan.takeProfit.toFixed(2)} (R:R ${risk.plan.rrRatio}), size ${risk.plan.qty}. ` +
    `Confidence ${confidence}%.${confluenceNote}` +
    (risk.notes.length ? ` Note: ${risk.notes.join('; ')}.` : '') +
    (rejected.length ? ` ${rejected.length} other strategies were not chosen.` : '');

  return make({
    action,
    side: best.side,
    chosenStrategy: meta(best.strategy),
    confidence,
    reasoning,
    agreement: agreementNames,
    riskPlan: risk.plan,
  });
}
