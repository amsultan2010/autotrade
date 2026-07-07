/**
 * 9. VWAP / Volume-Based Intraday Strategy (new).
 * Intraday only. Trades price behaviour around VWAP with relative-volume and
 * liquidity gating. Stands down in thin/wide-spread names.
 *
 * Requires a session VWAP (ctx.vwap). If the caller hasn't computed one yet, the
 * strategy abstains rather than guessing.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, block, relVolume } from '../helpers';

export const VwapIntraday: Strategy = {
  internalName: 'vwap_intraday_v1',
  displayName: 'VWAP Intraday Strategy',
  description:
    'Intraday strategy that trades reclaim/rejection of VWAP with relative-volume confirmation. Hard-blocks low-liquidity or wide-spread symbols.',
  source: 'experimental', // needs intraday VWAP + microstructure data to be reliable
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND', 'BREAKOUT_SETUP', 'RANGING'],
  avoidRegimes: ['LOW_LIQUIDITY', 'RISK_OFF', 'NEWS_EVENT', 'CONFLICTING'],
  indicators: ['VWAP reclaim/reject', 'relative volume', 'bid/ask spread', 'intraday trend'],
  requiredInputs: ['Intraday candles', 'session VWAP', 'liquidity (spread / relative volume)'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.intraday) return abstain('Not an intraday cycle');
    if (ctx.vwap == null) return abstain('No session VWAP available');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    // Liquidity hard-gates (this strategy is most exposed to bad fills).
    const liq = ctx.liquidity;
    if (liq?.spreadPct != null && liq.spreadPct > 0.5) return block('Spread too wide for VWAP scalping');
    if (liq?.relativeVolume != null && liq.relativeVolume < 0.8) return block('Below-average volume — VWAP unreliable');

    const reasons: string[] = [];
    const doNotTrade: string[] = [];
    const aboveVwap = s.price > ctx.vwap;
    const distPct = Math.abs(s.price - ctx.vwap) / ctx.vwap * 100;

    // Trade in the direction of the VWAP side, on a reclaim with volume.
    const side = aboveVwap ? 'LONG' : 'SHORT';
    if (ctx.isCrypto && side === 'SHORT') return abstain('Crypto is long-only');

    let score = 24;
    reasons.push(`Price ${aboveVwap ? 'above' : 'below'} VWAP (${distPct.toFixed(2)}% away)`);

    const rv = relVolume(entry);
    if (rv >= 1.3) { score += 26; reasons.push(`Relative volume ${rv.toFixed(1)}× confirms participation`); }
    else { doNotTrade.push('Insufficient relative volume for an intraday VWAP trade'); }

    // Trend alignment with the short EMAs.
    const emaUp = s.ema9 > s.ema21;
    if (side === 'LONG' && emaUp) { score += 16; reasons.push('Short EMAs trending up with VWAP'); }
    if (side === 'SHORT' && !emaUp) { score += 16; reasons.push('Short EMAs trending down with VWAP'); }

    // Don't chase price far from VWAP (poor R:R intraday).
    if (distPct > 1.5) doNotTrade.push('Price extended > 1.5% from VWAP — poor intraday R:R');

    return { applicable: true, side, score: Math.min(100, score), reasons, doNotTrade };
  },
};
