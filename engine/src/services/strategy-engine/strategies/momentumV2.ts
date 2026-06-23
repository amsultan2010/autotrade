/**
 * 2. Momentum Strategy (new).
 * Trades strong directional moves confirmed by volume. Avoids late entries into
 * overextended moves.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../types';
import { abstain, atrPct, relVolume } from '../helpers';

export const MomentumV2: Strategy = {
  internalName: 'momentum_v2',
  displayName: 'Momentum Strategy',
  description:
    'Rides strong price moves confirmed by a volume surge and MACD/RSI momentum. Reduces or rejects late entries when the move looks overextended.',
  source: 'new',
  bestRegimes: ['STRONG_UPTREND', 'STRONG_DOWNTREND', 'HIGH_VOLATILITY', 'BREAKOUT_SETUP'],
  avoidRegimes: ['RANGING', 'LOW_VOLATILITY', 'LOW_LIQUIDITY', 'RISK_OFF', 'CONFLICTING'],
  indicators: ['RSI strength', 'rate of change', 'volume spikes', 'MACD momentum', 'EMA stack'],
  requiredInputs: ['Entry-timeframe candles'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    const up = s.price > s.ema9 && s.ema9 > s.ema21;
    const down = s.price < s.ema9 && s.ema9 < s.ema21;
    if (!up && !down) return abstain('No clean momentum stack');
    // Crypto is long-only here (matches the rest of the engine).
    if (ctx.isCrypto && down) return abstain('Crypto is long-only; bearish momentum skipped');

    const side = up ? 'LONG' : 'SHORT';
    const reasons: string[] = [];
    const doNotTrade: string[] = [];
    let score = 22;
    reasons.push(`Price riding the EMA9/EMA21 stack (${up ? 'up' : 'down'})`);

    // Volume confirmation is the heart of momentum.
    const rv = relVolume(entry);
    if (rv >= 1.5) { score += 28; reasons.push(`Strong volume surge (${rv.toFixed(1)}× average)`); }
    else if (rv >= 1.2) { score += 15; reasons.push(`Above-average volume (${rv.toFixed(1)}×)`); }
    else { doNotTrade.push('No volume confirmation — momentum unconfirmed'); }

    // MACD momentum.
    const macdAligned = side === 'LONG' ? s.macd.histogram > 0 : s.macd.histogram < 0;
    if (macdAligned) { score += 15; reasons.push('MACD momentum aligned'); }

    // RSI in the momentum zone — but reject the chase if overextended.
    if (side === 'LONG') {
      if (s.rsi14 >= 55 && s.rsi14 <= 72) { score += 15; reasons.push(`RSI in momentum zone (${s.rsi14.toFixed(0)})`); }
      else if (s.rsi14 > 78) doNotTrade.push('RSI overextended (> 78) — avoiding a late long');
    } else {
      if (s.rsi14 <= 45 && s.rsi14 >= 28) { score += 15; reasons.push(`RSI in momentum zone (${s.rsi14.toFixed(0)})`); }
      else if (s.rsi14 < 22) doNotTrade.push('RSI overextended (< 22) — avoiding a late short');
    }

    // Expanding volatility supports momentum continuation.
    if (atrPct(entry) >= 1.5) { score += 5; reasons.push('Volatility expanding'); }

    return { applicable: true, side, score: Math.min(100, score), reasons, doNotTrade };
  },
};
