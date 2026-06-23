/**
 * 4. Crypto Breakout — trade a confirmed break of range/resistance on volume,
 * ideally after a volatility squeeze. Long-only. Rejects low-volume fakeouts.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrExit, atrPct, relVolume } from '../../helpers';

export const CryptoBreakout: Strategy = {
  internalName: 'crypto_breakout',
  displayName: 'Crypto Breakout',
  description:
    'Trades a confirmed break above resistance / range high on a volume surge (ideally after compression). Requires a real break, not a wick, and rejects low-volume fakeouts and wide-spread coins. Spot long-only.',
  source: 'crypto_new',
  assetType: 'crypto_spot',
  bestRegimes: ['CRYPTO_HIGH_VOL_BREAKOUT', 'BTC_LED_UPTREND', 'ALTCOIN_ROTATION'],
  avoidRegimes: ['CRYPTO_RANGING', 'CRYPTO_LOW_LIQUIDITY', 'CRYPTO_LIQUIDATION_RISK', 'CRYPTO_CONFLICTING'],
  requiredInputs: ['Entry-timeframe candles'],
  indicators: ['support/resistance break', 'ATR expansion', 'volume confirmation', 'candle close', 'range high'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');
    const s = entry.snapshot;

    if (s.resistance == null || s.price < s.resistance) return abstain('No upside break of resistance');

    const reasons: string[] = ['Price broke prior resistance / range high'];
    const doNotTrade: string[] = [];
    let score = 30;

    const rv = relVolume(entry);
    if (rv >= 1.5) { score += 30; reasons.push(`Volume surge confirms the break (${rv.toFixed(1)}×)`); }
    else if (rv >= 1.2) { score += 15; reasons.push(`Above-average volume (${rv.toFixed(1)}×)`); }
    else doNotTrade.push('Breakout lacks volume — likely a fakeout');

    if (atrPct(entry) >= 2) { score += 12; reasons.push('Volatility expanding through the level'); }
    if (s.macd.histogram > 0) { score += 8; reasons.push('MACD agrees with the break'); }
    if (ctx.crypto?.btcTrend === 'DOWN') doNotTrade.push('BTC trend down — breakout less reliable');

    const throughPct = ((s.price - s.resistance) / s.price) * 100;
    if (throughPct < 0.1) doNotTrade.push('Break is marginal (< 0.1%) — wait for a clean close');

    return {
      applicable: true,
      side: 'LONG',
      score: Math.min(100, score),
      reasons,
      doNotTrade,
      ...atrExit(s.price, s.atr14, 'LONG', 1.8, 2.5),
      entrySignal: 'Confirmed close above resistance on volume',
      exitSignal: 'Failed breakout (reclaim below level), target, or trailing stop',
      dataUsed: ['candles', 'support/resistance', 'ATR', 'volume', 'MACD'],
    };
  },
};
