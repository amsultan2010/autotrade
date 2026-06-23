/**
 * 1. Crypto Trend-Following — trade a clear, BTC-confirmed crypto trend.
 * Long-only (spot). Avoids chop, weak volume, and BTC fighting the coin.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrExit, isUptrend, relVolume } from '../../helpers';

export const CryptoTrendFollowing: Strategy = {
  internalName: 'crypto_trend_following',
  displayName: 'Crypto Trend-Following',
  description:
    'Rides a clear crypto uptrend confirmed by EMA alignment, ADX strength, MACD, volume, and BTC trend. Spot long-only; stands down in chop or when BTC disagrees.',
  source: 'crypto_new',
  assetType: 'crypto_spot',
  bestRegimes: ['BTC_LED_UPTREND', 'ALTCOIN_ROTATION'],
  avoidRegimes: ['CRYPTO_RANGING', 'CRYPTO_LOW_LIQUIDITY', 'CRYPTO_LIQUIDATION_RISK', 'CRYPTO_CONFLICTING'],
  requiredInputs: ['Multi-timeframe candles', 'BTC/ETH trend (optional, improves confidence)'],
  indicators: ['EMA/SMA alignment', 'MACD', 'ADX', 'higher highs/lows', 'volume', 'BTC trend'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const bias = ctx.analysis[ctx.biasTf];
    const entry = ctx.analysis[ctx.entryTf];
    if (!bias || !entry) return abstain('No multi-timeframe data');
    if (!isUptrend(bias)) return abstain('No clear uptrend (crypto is long-only)');

    const e = entry.snapshot;
    const reasons: string[] = ['Higher-timeframe uptrend: EMA9 > EMA21 > SMA50'];
    const doNotTrade: string[] = [];
    let score = 28;

    const adx = bias.extra.adx;
    if (adx >= 30) { score += 24; reasons.push(`Strong trend (ADX ${adx.toFixed(0)})`); }
    else if (adx >= 22) { score += 12; reasons.push(`Moderate trend (ADX ${adx.toFixed(0)})`); }
    else doNotTrade.push('Trend too weak (ADX < 22) — likely chop');

    if (e.macd.histogram > 0) { score += 14; reasons.push('MACD histogram confirms'); }
    if (relVolume(entry) >= 1.2) { score += 12; reasons.push('Above-average volume confirms'); }
    else doNotTrade.push('Volume not confirming the trend');

    if (ctx.crypto?.btcTrend === 'UP') { score += 12; reasons.push('BTC trend up confirms'); }
    else if (ctx.crypto?.btcTrend === 'DOWN') doNotTrade.push('BTC trend down — conflicting with a long');

    if (e.rsi14 > 82) doNotTrade.push('Overbought (RSI > 82) — risk of chasing');

    return {
      applicable: true,
      side: 'LONG',
      score: Math.min(100, score),
      reasons,
      doNotTrade,
      ...atrExit(e.price, e.atr14, 'LONG', 2.5, 3.0),
      entrySignal: 'Trend continuation with volume + BTC confirmation',
      exitSignal: 'Trend weakness, EMA breakdown, or trailing stop',
      dataUsed: ['candles', 'EMA', 'MACD', 'ADX', 'volume', 'BTC trend'],
    };
  },
};
