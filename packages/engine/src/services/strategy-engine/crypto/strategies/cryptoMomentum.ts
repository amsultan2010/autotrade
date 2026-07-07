/**
 * 2. Crypto Momentum — ride a strong move backed by abnormal volume and coin
 * strength vs BTC/ETH. Long-only. Rejects late entries after blow-off candles.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrExit, atrPct, relVolume } from '../../helpers';

export const CryptoMomentum: Strategy = {
  internalName: 'crypto_momentum',
  displayName: 'Crypto Momentum',
  description:
    'Buys strong momentum confirmed by a volume surge, MACD, and the coin outperforming BTC/ETH — while refusing overextended, late entries. Spot long-only.',
  source: 'crypto_new',
  assetType: 'crypto_spot',
  bestRegimes: ['BTC_LED_UPTREND', 'ALTCOIN_ROTATION', 'CRYPTO_HIGH_VOL_BREAKOUT'],
  avoidRegimes: ['CRYPTO_RANGING', 'CRYPTO_LOW_LIQUIDITY', 'CRYPTO_LIQUIDATION_RISK', 'CRYPTO_CONFLICTING'],
  requiredInputs: ['Entry-timeframe candles', 'coin strength vs BTC (optional)'],
  indicators: ['RSI strength', 'rate of change', 'relative volume', 'MACD', 'price acceleration', 'strength vs BTC'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    const up = s.price > s.ema9 && s.ema9 > s.ema21;
    if (!up) return abstain('No bullish momentum stack (crypto long-only)');

    const reasons: string[] = ['Price riding the EMA9 > EMA21 stack'];
    const doNotTrade: string[] = [];
    let score = 24;

    const rv = relVolume(entry);
    if (rv >= 1.5) { score += 26; reasons.push(`Strong volume surge (${rv.toFixed(1)}×)`); }
    else if (rv >= 1.2) { score += 14; reasons.push(`Above-average volume (${rv.toFixed(1)}×)`); }
    else doNotTrade.push('No volume confirmation — momentum unconfirmed');

    if (s.macd.histogram > 0) { score += 12; reasons.push('MACD momentum positive'); }

    if (s.rsi14 >= 55 && s.rsi14 <= 72) { score += 14; reasons.push(`RSI in momentum zone (${s.rsi14.toFixed(0)})`); }
    else if (s.rsi14 > 80) doNotTrade.push('RSI overextended (> 80) — avoiding a late entry');

    const strength = ctx.crypto?.strengthVsBtc;
    if (strength != null && strength > 0.2) { score += 12; reasons.push('Outperforming BTC'); }
    if (atrPct(entry) >= 2) { score += 6; reasons.push('Volatility expanding'); }

    return {
      applicable: true,
      side: 'LONG',
      score: Math.min(100, score),
      reasons,
      doNotTrade,
      ...atrExit(s.price, s.atr14, 'LONG', 2.0, 2.5),
      entrySignal: 'Momentum + volume surge, not overextended',
      exitSignal: 'Momentum fade, volume drop, RSI exhaustion, or trailing stop',
      dataUsed: ['candles', 'RSI', 'MACD', 'volume', 'strength vs BTC'],
    };
  },
};
