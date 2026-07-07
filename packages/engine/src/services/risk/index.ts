/**
 * RiskManager — the gate every order passes through, paper or live (req #13).
 * It enforces the user's hard caps and sizes positions; it can VETO any signal
 * regardless of confidence, and `mode=DISABLED` is an instant kill-switch.
 */
import type { ExecutionMode, TradeSignal, TradeSide } from '@autotrade/shared';
import { minutesSinceMidnightEastern, parseHHMM } from '../../lib/market-hours';

export interface RiskSettings {
  mode: ExecutionMode;
  maxActiveTrades: number;
  maxTradeSize: number;
  riskPerTradePct: number;
  maxDailyLoss: number;
  tradingHoursStart: string; // "HH:MM"
  tradingHoursEnd: string;
}

export interface RiskContext {
  equity: number;
  openTradeCount: number;
  realizedPnlToday: number;
  /** Minutes since US Eastern midnight, for the trading-hours check. */
  nowMinutes?: number;
}

export type RiskDecision =
  | { approved: true; qty: number; side: TradeSide; stopLoss: number; takeProfit: number }
  | { approved: false; reason: string };

export function evaluateRisk(
  signal: TradeSignal,
  settings: RiskSettings,
  ctx: RiskContext,
): RiskDecision {
  if (settings.mode === 'DISABLED') {
    return { approved: false, reason: 'Trading is disabled (kill-switch active)' };
  }
  if (signal.action !== 'BUY' && signal.action !== 'SELL') {
    return { approved: false, reason: `Signal action is ${signal.action}, not an entry` };
  }
  if (signal.stopLoss == null || signal.takeProfit == null || signal.price <= 0) {
    return { approved: false, reason: 'Signal is missing stop/target/price' };
  }

  // Crypto (BTC/USD style) is spot-only on Alpaca: no shorting, and it trades
  // 24/7 so it's exempt from the user's stock trading-hours window.
  const isCrypto = signal.ticker.includes('/');
  if (isCrypto && signal.action === 'SELL') {
    return { approved: false, reason: 'Shorting spot crypto is not supported' };
  }

  // Trading hours — US Eastern (stocks only; crypto is 24/7).
  if (!isCrypto) {
    const nowMin = ctx.nowMinutes ?? minutesSinceMidnightEastern();
    const start = parseHHMM(settings.tradingHoursStart);
    const end = parseHHMM(settings.tradingHoursEnd);
    if (nowMin < start || nowMin > end) {
      return {
        approved: false,
        reason: `Outside allowed trading hours (${settings.tradingHoursStart}–${settings.tradingHoursEnd} ET)`,
      };
    }
  }

  if (ctx.openTradeCount >= settings.maxActiveTrades) {
    return { approved: false, reason: `Max active trades reached (${settings.maxActiveTrades})` };
  }

  // Daily loss cutoff: realizedPnlToday is negative when down.
  if (ctx.realizedPnlToday <= -Math.abs(settings.maxDailyLoss)) {
    return { approved: false, reason: 'Max daily loss reached — trading halted for today' };
  }

  const side: TradeSide = signal.action === 'BUY' ? 'LONG' : 'SHORT';
  const stopDistance = Math.abs(signal.price - signal.stopLoss);
  if (stopDistance <= 0) return { approved: false, reason: 'Invalid stop distance' };

  // Position sizing: risk a fixed % of equity per trade.
  const riskAmount = (ctx.equity * settings.riskPerTradePct) / 100;
  let qty = riskAmount / stopDistance;

  // Cap notional exposure by maxTradeSize.
  const maxQtyByNotional = settings.maxTradeSize / signal.price;
  qty = Math.min(qty, maxQtyByNotional);
  qty = Math.floor(qty * 1e4) / 1e4; // 4dp; fractional allowed for paper

  if (qty <= 0) {
    return { approved: false, reason: 'Computed position size is zero (raise trade size or risk %)' };
  }

  return { approved: true, qty, side, stopLoss: signal.stopLoss, takeProfit: signal.takeProfit };
}
