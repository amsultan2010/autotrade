/**
 * 10. Market-Regime / Risk-On-Risk-Off Strategy (new, OVERLAY).
 * Not an entry strategy — a master filter. It decides whether the bot should
 * trade aggressively, lightly, or not at all, and can VETO every other strategy.
 *
 * The selector treats `overlay: true` strategies specially: a non-empty
 * `doNotTrade` here blocks the whole decision regardless of other signals.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';

export const MarketRegimeOverlay: Strategy = {
  internalName: 'market_regime_overlay_v1',
  displayName: 'Market-Regime Overlay (Risk-On/Off)',
  description:
    'Master risk filter over all other strategies. Uses index trend (SPY/QQQ), a volatility proxy (VIX), and breadth to allow, throttle, or veto trading. Crypto is exempt from the equity risk-off veto.',
  source: 'new',
  overlay: true,
  bestRegimes: [
    'STRONG_UPTREND', 'STRONG_DOWNTREND', 'RANGING', 'HIGH_VOLATILITY',
    'LOW_VOLATILITY', 'NEWS_EVENT', 'BREAKOUT_SETUP', 'RISK_OFF',
  ],
  indicators: ['SPY/QQQ trend', 'VIX / volatility proxy', 'market breadth', 'regime'],
  requiredInputs: ['Market context (index trend, VIX, breadth) — optional but recommended'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const reasons: string[] = [];
    const doNotTrade: string[] = [];

    // Crypto trades 24/7 and is not gated by the equity market's risk state.
    if (ctx.isCrypto) {
      return { applicable: true, side: null, score: 60, reasons: ['Crypto — not gated by equity risk-off'], doNotTrade: [] };
    }

    // Hard regimes that should stop trading outright.
    if (ctx.regime === 'RISK_OFF') doNotTrade.push('Market-wide risk-off — standing down');
    if (ctx.regime === 'LOW_LIQUIDITY') doNotTrade.push('Unsafe liquidity — standing down');

    const m = ctx.market;
    if (!m) {
      // No market context: don't veto, but don't boost confidence either.
      return { applicable: true, side: null, score: 50, reasons: ['No market context — neutral risk posture'], doNotTrade };
    }

    // Risk appetite score (0–100): higher = more risk-on.
    let appetite = 50;
    if (m.spyTrend === 'UP') { appetite += 12; reasons.push('SPY trending up'); }
    if (m.spyTrend === 'DOWN') { appetite -= 18; reasons.push('SPY trending down'); }
    if (m.qqqTrend === 'UP') { appetite += 8; reasons.push('QQQ trending up'); }
    if (m.qqqTrend === 'DOWN') { appetite -= 12; reasons.push('QQQ trending down'); }
    if (m.vix != null) {
      if (m.vix >= 28) { doNotTrade.push(`VIX elevated (${m.vix.toFixed(0)}) — risk-off`); appetite -= 25; }
      else if (m.vix <= 16) { appetite += 10; reasons.push(`VIX calm (${m.vix.toFixed(0)})`); }
    }
    if (m.breadthPct != null) {
      if (m.breadthPct >= 60) { appetite += 8; reasons.push(`Strong breadth (${m.breadthPct.toFixed(0)}%)`); }
      else if (m.breadthPct < 30) { appetite -= 15; reasons.push(`Weak breadth (${m.breadthPct.toFixed(0)}%)`); }
    }

    return {
      applicable: true,
      side: null,
      score: Math.max(0, Math.min(100, appetite)),
      reasons,
      doNotTrade,
    };
  },
};
