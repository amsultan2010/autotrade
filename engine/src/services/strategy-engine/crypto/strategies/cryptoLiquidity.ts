/**
 * 10. Crypto Liquidity / Order-Book — OVERLAY (safety filter across all crypto
 * strategies). Not an entry strategy. It vetoes trades the bot can't enter/exit
 * safely: wide spreads, thin depth, low 24h volume, or high slippage.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';

export const CryptoLiquidity: Strategy = {
  internalName: 'crypto_liquidity_guard',
  displayName: 'Crypto Liquidity / Order-Book Guard',
  description:
    'Safety filter for every crypto trade. Blocks symbols with wide bid/ask spreads, thin order-book depth, low 24h volume, or high estimated slippage — assets the bot could not exit cleanly.',
  source: 'crypto_new',
  assetType: 'mixed',
  overlay: true,
  bestRegimes: [
    'BTC_LED_UPTREND', 'BTC_LED_DOWNTREND', 'ALTCOIN_ROTATION', 'CRYPTO_RANGING',
    'CRYPTO_HIGH_VOL_BREAKOUT', 'CRYPTO_LOW_LIQUIDITY', 'CRYPTO_NEWS_DRIVEN',
  ],
  requiredInputs: ['Order-book context: spread, depth, 24h volume, slippage (optional but recommended)'],
  indicators: ['bid/ask spread', 'order-book depth', 'slippage estimate', '24h volume', 'relative volume'],
  supports: { backtest: true, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return { applicable: false, side: null, score: 0, reasons: [], doNotTrade: [] };
    const ob = ctx.crypto?.orderBook;
    const liq = ctx.liquidity;
    const reasons: string[] = [];
    const doNotTrade: string[] = [];

    if (!ob && !liq) {
      return { applicable: true, side: null, score: 50, reasons: ['No order-book data — liquidity unchecked'], doNotTrade };
    }

    const spread = ob?.spreadPct ?? liq?.spreadPct;
    const vol24 = ob?.volume24hUsd;
    const slip = ob?.slippageEstPct;
    const depth = ob?.depthUsdNearTouch;

    if (spread != null && spread > 0.6) doNotTrade.push(`Spread too wide (${spread.toFixed(2)}%)`);
    if (vol24 != null && vol24 < 5_000_000) doNotTrade.push(`24h volume too low ($${(vol24 / 1e6).toFixed(1)}M)`);
    if (slip != null && slip > 1) doNotTrade.push(`Estimated slippage too high (${slip.toFixed(2)}%)`);
    if (depth != null && depth < 50_000) doNotTrade.push('Order-book depth too thin near touch');

    if (doNotTrade.length === 0) reasons.push('Liquidity acceptable (spread / depth / volume OK)');
    return {
      applicable: true,
      side: null,
      score: doNotTrade.length ? 0 : 70,
      reasons,
      doNotTrade,
      dataUsed: ['spread', 'depth', '24h volume', 'slippage'],
    };
  },
};
