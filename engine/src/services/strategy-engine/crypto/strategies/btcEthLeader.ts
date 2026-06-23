/**
 * 9. BTC/ETH Market-Leader — OVERLAY (master crypto filter).
 * Not an entry strategy. It scales confidence and can VETO altcoin longs when
 * BTC is falling, since alts rarely hold up in a broad crypto risk-off.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';

function isMajor(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s.startsWith('BTC') || s.startsWith('ETH');
}

export const BtcEthLeader: Strategy = {
  internalName: 'crypto_btc_eth_leader',
  displayName: 'BTC/ETH Market-Leader Filter',
  description:
    'Master crypto filter. Uses BTC/ETH trend, BTC dominance, and the ETH/BTC ratio to decide whether altcoin longs are allowed. Vetoes altcoin longs during broad crypto risk-off (BTC dumping); boosts confidence when BTC is stable/up and alt strength is rising.',
  source: 'crypto_new',
  assetType: 'mixed',
  overlay: true,
  bestRegimes: [
    'BTC_LED_UPTREND', 'BTC_LED_DOWNTREND', 'ALTCOIN_ROTATION', 'CRYPTO_RANGING',
    'CRYPTO_HIGH_VOL_BREAKOUT', 'CRYPTO_NEWS_DRIVEN', 'CRYPTO_CONFLICTING',
  ],
  requiredInputs: ['Crypto context: BTC/ETH trend, dominance, ETH/BTC ratio (optional but recommended)'],
  indicators: ['BTC trend', 'ETH trend', 'BTC dominance', 'ETH/BTC ratio', 'total market cap'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return { applicable: false, side: null, score: 0, reasons: [], doNotTrade: [] };
    const c = ctx.crypto;
    const reasons: string[] = [];
    const doNotTrade: string[] = [];

    if (!c) {
      return { applicable: true, side: null, score: 50, reasons: ['No BTC/ETH context — neutral crypto posture'], doNotTrade };
    }

    const major = isMajor(ctx.symbol);
    let appetite = 50;

    if (c.btcTrend === 'UP') { appetite += 12; reasons.push('BTC trending up'); }
    if (c.btcTrend === 'DOWN') {
      appetite -= 20;
      reasons.push('BTC trending down');
      // Only veto altcoins that are THEMSELVES in a BTC-led downtrend. A ranging
      // or independently-strong altcoin can still take an oversold-bounce long,
      // just at reduced confidence — so the bot isn't frozen on every BTC dip.
      if (!major && ctx.regime === 'BTC_LED_DOWNTREND') {
        doNotTrade.push('Altcoin following BTC down — no long here');
      }
    }
    if (c.ethTrend === 'UP') { appetite += 6; reasons.push('ETH trending up'); }
    if (c.btcDominanceTrend === 'UP' && !major) { appetite -= 10; reasons.push('BTC dominance rising — small alts riskier'); }
    if (c.ethBtcRatioTrend === 'UP') { appetite += 6; reasons.push('ETH/BTC rising — alt strength'); }
    if (!major && (c.strengthVsBtc ?? 0) > 0.2) { appetite += 8; reasons.push('This coin outperforming BTC'); }

    return {
      applicable: true,
      side: null,
      score: Math.max(0, Math.min(100, appetite)),
      reasons,
      doNotTrade,
      dataUsed: ['BTC/ETH trend', 'dominance', 'ETH/BTC ratio'],
    };
  },
};
