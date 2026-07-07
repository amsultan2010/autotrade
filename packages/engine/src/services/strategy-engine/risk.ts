/**
 * Strategy-Engine RiskManager.
 *
 * This LAYERS new, explicit risk rules on top of the original risk engine — it
 * does NOT replace it. The original `evaluateRisk` is preserved and re-exported
 * here as `LegacyRiskManager` / `legacyEvaluateRisk`, and is still the component
 * that does final position sizing, trading-hours, max-trades, and daily-loss
 * checks. The new rules (R:R floor, liquidity, spread, extreme-volatility gate,
 * confidence floor) run FIRST and can veto before sizing.
 *
 * Order of checks is deliberately "cheapest / most decisive rejection first".
 */
import type { RiskLevel, TradeSide, TradeSignal } from '@autotrade/shared';
import { evaluateRisk, type RiskContext, type RiskSettings } from '../risk/index';
import { atrPct } from './helpers';
import type { AccountState, RiskPlan, StrategyContext } from './types';

// Preserve the original risk engine under explicit "legacy" names.
export { evaluateRisk as legacyEvaluateRisk };
export type { RiskSettings, RiskContext } from '../risk/index';
/** The original RiskManager, unchanged — sizes positions and enforces hard caps. */
export const LegacyRiskManager = { evaluate: evaluateRisk };

/** Tunable risk thresholds the new gates use (resolved from user mode in config.ts). */
export interface RiskThresholds {
  minRR: number; // minimum reward:risk to allow an entry (e.g. 1.5)
  maxSpreadPct: number; // reject if bid/ask spread % exceeds this
  minRelativeVolume: number; // reject if today's volume is below this multiple of avg
  extremeVolAtrPct: number; // ATR% above this = "extreme"; needs high-risk mode
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  minRR: 1.2,
  maxSpreadPct: 0.8,
  minRelativeVolume: 0.3,
  extremeVolAtrPct: 6,
};

export type RiskAssessment =
  | { ok: true; plan: RiskPlan; notes: string[] }
  | { ok: false; reasons: string[] };

function riskLevelFor(atrPctVal: number): RiskLevel {
  if (atrPctVal >= 4) return 'HIGH';
  if (atrPctVal >= 1.5) return 'MEDIUM';
  return 'LOW';
}

export interface AssessRiskArgs {
  ctx: StrategyContext;
  side: TradeSide;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  account: AccountState;
  settings: RiskSettings;
  thresholds?: RiskThresholds;
}

/**
 * Run every risk gate. Returns an approved RiskPlan (with sizing from the legacy
 * engine) or the list of reasons it was rejected.
 */
export function assessRisk(args: AssessRiskArgs): RiskAssessment {
  const { ctx, side, entryPrice, stopLoss, takeProfit, confidence, account, settings } = args;
  const thresholds = args.thresholds ?? DEFAULT_RISK_THRESHOLDS;
  const reasons: string[] = [];
  const notes: string[] = [];

  // Paper mode uses a slightly lower bar so learning runs produce real fills.
  const effectiveMinConfidence =
    settings.mode === 'PAPER'
      ? Math.max(40, ctx.minConfidence - 15)
      : ctx.minConfidence;

  // 1) Confidence floor.
  if (confidence < effectiveMinConfidence) {
    reasons.push(`Confidence ${confidence}% below the ${effectiveMinConfidence}% minimum`);
  }

  // 2) Stop + target must exist and be sane (req: stop & target required pre-entry).
  if (!(entryPrice > 0) || !(stopLoss > 0) || !(takeProfit > 0)) {
    reasons.push('Missing or invalid entry/stop/target');
    return { ok: false, reasons };
  }
  const stopDist = Math.abs(entryPrice - stopLoss);
  const rewardDist = Math.abs(takeProfit - entryPrice);
  if (stopDist <= 0) {
    reasons.push('Stop distance is zero');
    return { ok: false, reasons };
  }
  // Stop must be on the correct side of entry.
  const stopOnRightSide = side === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
  const targetOnRightSide = side === 'LONG' ? takeProfit > entryPrice : takeProfit < entryPrice;
  if (!stopOnRightSide || !targetOnRightSide) {
    reasons.push('Stop/target are on the wrong side of entry for this direction');
  }

  // 3) Reward:risk floor.
  const rr = rewardDist / stopDist;
  if (rr < thresholds.minRR) {
    reasons.push(`Reward:risk ${rr.toFixed(2)} below the ${thresholds.minRR} minimum`);
  }

  // 4) Liquidity / spread (when provided).
  const liq = ctx.liquidity;
  if (liq?.spreadPct != null && liq.spreadPct > thresholds.maxSpreadPct) {
    reasons.push(`Spread ${liq.spreadPct.toFixed(2)}% exceeds the ${thresholds.maxSpreadPct}% limit`);
  }
  if (liq?.relativeVolume != null && liq.relativeVolume < thresholds.minRelativeVolume) {
    reasons.push(`Relative volume ${liq.relativeVolume.toFixed(2)} below the ${thresholds.minRelativeVolume} floor`);
  }

  // 5) Extreme volatility gate (unless the user opted into high-risk mode).
  const entry = ctx.analysis[ctx.entryTf];
  const vol = entry ? atrPct(entry) : 0;
  if (vol >= thresholds.extremeVolAtrPct && !ctx.highRiskModeEnabled) {
    reasons.push(`Extreme volatility (ATR ${vol.toFixed(1)}%) — enable high-risk mode to trade it`);
  } else if (vol >= thresholds.extremeVolAtrPct) {
    notes.push('Trading extreme volatility under high-risk mode — size reduced by the risk engine');
  }

  if (reasons.length > 0) return { ok: false, reasons };

  // 6) Hand off to the ORIGINAL risk engine for trading-hours, max-trades,
  //    daily-loss, and final position sizing — preserved behavior.
  const signal: TradeSignal = {
    ticker: ctx.symbol,
    exchange: ctx.exchange,
    price: entryPrice,
    timeframe: ctx.entryTf,
    strategy: 'TrendBreakout', // sizing is strategy-agnostic; field unused by evaluateRisk
    action: side === 'LONG' ? 'BUY' : 'SELL',
    confidence,
    riskLevel: riskLevelFor(vol),
    entryReason: 'strategy-engine',
    stopLoss,
    takeProfit,
    rrRatio: Number(rr.toFixed(2)),
    explanation: '',
    createdAt: new Date().toISOString(),
  };
  const riskCtx: RiskContext = {
    equity: account.equity,
    openTradeCount: account.openTradeCount,
    realizedPnlToday: account.realizedPnlToday,
    nowMinutes: account.nowMinutes,
  };
  const decision = evaluateRisk(signal, settings, riskCtx);
  if (!decision.approved) {
    return { ok: false, reasons: [decision.approved ? 'unknown' : decision.reason] };
  }

  const riskAmount = (account.equity * settings.riskPerTradePct) / 100;
  const plan: RiskPlan = {
    qty: decision.qty,
    stopLoss: decision.stopLoss,
    takeProfit: decision.takeProfit,
    rrRatio: Number(rr.toFixed(2)),
    riskAmount: Number(riskAmount.toFixed(2)),
  };
  return { ok: true, plan, notes };
}
