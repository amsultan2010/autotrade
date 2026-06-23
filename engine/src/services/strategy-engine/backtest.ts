/**
 * Backtesting hooks (skeleton).
 *
 * Because every strategy is a PURE function of a StrategyContext, backtesting is
 * just: replay historical bars → build a context per bar → run the selector →
 * simulate the resulting trade against the bars that follow. This file provides
 * the minimal, working scaffolding and the types you'll expand into a full
 * event-driven backtester later.
 *
 * It intentionally reuses the SAME selector + risk path as live/paper, so a
 * backtest reflects real decision behaviour (no separate "backtest logic" to
 * drift out of sync).
 */
import { selectStrategy, type SelectOptions } from './selector';
import type { StrategyContext, StrategyDecision, RiskPlan } from './types';

/** Bars that occur AFTER a decision, used to resolve stop/target. */
export interface FutureBar {
  t: number;
  h: number;
  l: number;
  c: number;
}

export interface BacktestStep {
  ctx: StrategyContext;
  /** SelectOptions for this step (account state, risk settings, mode, etc.). */
  options: SelectOptions;
  /** Forward bars used to resolve the trade outcome (e.g. the next N bars). */
  futureBars: FutureBar[];
}

export interface SimulatedTrade {
  symbol: string;
  strategy: string | null;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  qty: number;
  exitPrice: number;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnl: number;
  barsHeld: number;
}

export interface BacktestResult {
  decisions: StrategyDecision[];
  trades: SimulatedTrade[];
  summary: {
    decisions: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number; // 0–1
    totalPnl: number;
    noTradeOrHold: number;
  };
}

/** Resolve one entry against the bars that follow it (stop/target/last-close). */
function simulateTrade(
  decision: StrategyDecision,
  plan: RiskPlan,
  side: 'LONG' | 'SHORT',
  futureBars: FutureBar[],
): SimulatedTrade {
  const entryPrice = decision.price;
  let exitPrice = entryPrice;
  let barsHeld = 0;

  for (const bar of futureBars) {
    barsHeld++;
    if (side === 'LONG') {
      // Conservative: assume the stop is checked before the target within a bar.
      if (bar.l <= plan.stopLoss) { exitPrice = plan.stopLoss; break; }
      if (bar.h >= plan.takeProfit) { exitPrice = plan.takeProfit; break; }
    } else {
      if (bar.h >= plan.stopLoss) { exitPrice = plan.stopLoss; break; }
      if (bar.l <= plan.takeProfit) { exitPrice = plan.takeProfit; break; }
    }
    exitPrice = bar.c; // mark to last close if neither hit
  }

  const pnl = (side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice) * plan.qty;
  const result: SimulatedTrade['result'] = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';
  return {
    symbol: decision.symbol,
    strategy: decision.chosenStrategy?.internalName ?? null,
    side,
    entryPrice,
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit,
    qty: plan.qty,
    exitPrice,
    result,
    pnl,
    barsHeld,
  };
}

/**
 * Run the engine across a sequence of pre-built steps. Each step is independent
 * here (no portfolio state carried between trades) — wire in shared AccountState
 * across steps when you build the full portfolio-aware backtester.
 */
export function runBacktest(steps: BacktestStep[]): BacktestResult {
  const decisions: StrategyDecision[] = [];
  const trades: SimulatedTrade[] = [];

  for (const step of steps) {
    const decision = selectStrategy(step.ctx, step.options);
    decisions.push(decision);

    const isEntry = decision.action === 'BUY' || decision.action === 'SHORT';
    if (isEntry && decision.riskPlan && decision.side) {
      const side = decision.side; // 'LONG' | 'SHORT'
      trades.push(simulateTrade(decision, decision.riskPlan, side, step.futureBars));
    }
  }

  const wins = trades.filter((t) => t.result === 'WIN').length;
  const losses = trades.filter((t) => t.result === 'LOSS').length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

  return {
    decisions,
    trades,
    summary: {
      decisions: decisions.length,
      trades: trades.length,
      wins,
      losses,
      winRate: trades.length ? wins / trades.length : 0,
      totalPnl,
      noTradeOrHold: decisions.filter((d) => d.action === 'NO_TRADE' || d.action === 'HOLD').length,
    },
  };
}
