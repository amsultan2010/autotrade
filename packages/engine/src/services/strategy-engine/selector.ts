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
  offRegimePenalty?: number; // score penalty when firing outside bestRegimes (default 8)
}

interface Candidate {
  strategy: Strategy;
  evaluation: StrategyEvaluation;
  adjustedScore: number;
  side: TradeSide;
}

function meta(s: Strategy) {
  return {
    internalName: s.internalName,
    displayName: s.displayName,
    source: s.source,
    assetType: s.assetType ?? ('stock' as const),
  };
}

/**
 * Per-strategy exit profile. The bot sizes each trade's stop and target to the
 * CURRENT volatility (ATR) so calm markets get tighter stops and volatile ones
 * get wider stops — and the multiplier/reward-to-risk fit each strategy's
 * character:
 *   - trend/breakout/momentum: wider stops, larger targets (let winners run)
 *   - mean-reversion / VWAP / pairs: tighter stops, quick targets (fast revert)
 *   - news/sentiment: wide stops (events are volatile), modest targets
 * `stopAtr` = stop distance in ATRs; `rr` = reward:risk (target = stop × rr).
 * A strategy may still override by returning its own stopLoss/takeProfit.
 */
const EXIT_PROFILE: Record<string, { stopAtr: number; rr: number }> = {
  trend_following_v2: { stopAtr: 2.5, rr: 3.0 },
  momentum_v2: { stopAtr: 2.0, rr: 2.5 },
  mean_reversion_v2: { stopAtr: 1.2, rr: 1.8 },
  breakout_v1: { stopAtr: 1.8, rr: 2.5 },
  pullback_in_trend_v1: { stopAtr: 1.5, rr: 2.5 },
  vwap_intraday_v1: { stopAtr: 1.2, rr: 2.0 },
  news_event_v1: { stopAtr: 2.5, rr: 2.0 },
  sentiment_v1: { stopAtr: 2.0, rr: 2.0 },
  stat_arb_pairs_v1: { stopAtr: 1.5, rr: 1.5 },
  legacy_trend_breakout: { stopAtr: 2.2, rr: 2.5 },
  legacy_pullback_continuation: { stopAtr: 1.6, rr: 2.0 },
  legacy_mean_reversion: { stopAtr: 1.3, rr: 1.8 },
  legacy_crypto_momentum: { stopAtr: 2.5, rr: 2.5 },
  // legacy_decision_engine returns its own stop/target (from the legacy engine).
};

export function selectStrategy(ctx: StrategyContext, opts: SelectOptions): StrategyDecision {
  const timestamp = new Date().toISOString();
  const entry = ctx.analysis[ctx.entryTf];
  const price = entry?.snapshot.price ?? 0;
  const rejected: RejectedStrategy[] = [];

  const make = (over: Partial<StrategyDecision>): StrategyDecision => ({
    action: 'NO_TRADE',
    side: null,
    directionBias: over.side === 'LONG' ? 'bullish' : over.side === 'SHORT' ? 'bearish' : 'neutral',
    symbol: ctx.symbol,
    exchange: ctx.exchange,
    assetType: ctx.assetType,
    price,
    regime: ctx.regime,
    chosenStrategy: null,
    confidence: 0,
    reasoning: '',
    agreement: [],
    rejected,
    riskPlan: null,
    trailingStop: null,
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
    // Crypto is spot/long-only — never short crypto, regardless of strategy.
    if (ctx.isCrypto && ev.side === 'SHORT') {
      rejected.push({ ...meta(strat), score: ev.score, reason: 'Crypto is long-only — short skipped' });
      continue;
    }
    // Allowed off-regime, but weaker.
    let adjustedScore = ev.score;
    if (!strat.bestRegimes.includes(ctx.regime)) {
      adjustedScore = Math.max(0, adjustedScore - (opts.offRegimePenalty ?? 8));
    }
    candidates.push({ strategy: strat, evaluation: ev, adjustedScore, side: ev.side });
  }

  // ── 3) Conflict block: strong signals both ways → stand down. ──
  const conflictTh = opts.conflictThreshold ?? 58;
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
  // Boost actionable setups that cleared strategy filters but scored modestly.
  const setupBoost = best.adjustedScore >= 35 && best.evaluation.doNotTrade.length === 0 ? 8 : 0;
  const confidence = Math.min(100, Math.round(best.adjustedScore + bonus + setupBoost));

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

  // ── 5) Stop / target: per-strategy profile, scaled by current volatility (ATR).
  // Each strategy sets its own stop/target sized to how the market is actually
  // moving right now (ATR) with a reward:risk that fits the strategy. The stop is
  // floored by a small % so near-zero ATR can't make it absurdly tight, and the
  // R:R falls back to the user's stop/target settings for unknown strategies.
  const atr = entry.snapshot.atr14;
  const stopPctFloor = ctx.defaultStopPct ?? 2.0;
  const fallbackRr = stopPctFloor > 0 ? (ctx.defaultTakeProfitPct ?? 4.0) / stopPctFloor : 2;
  const profile = EXIT_PROFILE[best.strategy.internalName] ?? { stopAtr: 1.5, rr: fallbackRr };
  const stopDist = Math.max(atr * profile.stopAtr, (price * stopPctFloor) / 100);
  const stopLoss =
    best.evaluation.stopLoss ?? (best.side === 'LONG' ? price - stopDist : price + stopDist);
  const takeProfit =
    best.evaluation.takeProfit ??
    (best.side === 'LONG' ? price + stopDist * profile.rr : price - stopDist * profile.rr);

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
      blockReasons: risk.ok ? [] : risk.reasons,
      agreement: agreementNames,
      reasoning:
        `${best.strategy.displayName} signalled ${best.side} on ${ctx.symbol} ` +
        `(confidence ${confidence}%), but the trade was blocked: ${risk.ok ? '' : risk.reasons.join('; ')}.`,
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
    trailingStop: best.evaluation.trailingStop ?? null,
    entrySignal: best.evaluation.entrySignal,
    exitSignal: best.evaluation.exitSignal,
    dataUsed: best.evaluation.dataUsed,
  });
}
