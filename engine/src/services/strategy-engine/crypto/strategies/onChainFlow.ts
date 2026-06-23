/**
 * 7. On-Chain / Exchange-Flow (EXPERIMENTAL — needs on-chain data).
 * Uses exchange inflows/outflows, stablecoin inflows, and whale flow as
 * CONFIRMATION with price/volume — never alone. Abstains without on-chain data.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrExit, isUptrend } from '../../helpers';

export const OnChainFlow: Strategy = {
  internalName: 'crypto_onchain_flow',
  displayName: 'On-Chain / Exchange Flow',
  description:
    'Confirms (never initiates) crypto longs with on-chain flows: exchange outflows + stablecoin inflows + accumulating whales, alongside an uptrend. Reduces confidence when flows contradict price. Abstains without on-chain data.',
  source: 'experimental',
  assetType: 'crypto_spot',
  bestRegimes: ['BTC_LED_UPTREND', 'ALTCOIN_ROTATION', 'CRYPTO_RANGING'],
  avoidRegimes: ['CRYPTO_LOW_LIQUIDITY', 'CRYPTO_LIQUIDATION_RISK', 'CRYPTO_CONFLICTING'],
  requiredInputs: ['Exchange inflows/outflows', 'stablecoin inflows', 'whale net flow'],
  indicators: ['exchange in/outflows', 'stablecoin inflows', 'whale net flow', 'active addresses'],
  supports: { backtest: false, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const oc = ctx.crypto?.onChain;
    if (!oc) return abstain('No on-chain data available');
    const bias = ctx.analysis[ctx.biasTf];
    const entry = ctx.analysis[ctx.entryTf];
    if (!bias || !entry) return abstain('No multi-timeframe data');

    // Confirmation only — needs an uptrend to confirm.
    if (!isUptrend(bias)) return abstain('No uptrend to confirm (long-only)');

    const reasons: string[] = [];
    const doNotTrade: string[] = [];
    let score = 30;

    const outflow = (oc.exchangeOutflowUsd ?? 0) - (oc.exchangeInflowUsd ?? 0);
    if (outflow > 0) { score += 18; reasons.push('Net exchange OUTflows (accumulation)'); }
    else if (outflow < 0) doNotTrade.push('Net exchange INflows — potential sell pressure');
    if ((oc.stablecoinInflowUsd ?? 0) > 0) { score += 12; reasons.push('Stablecoin inflows (buying power)'); }
    if ((oc.whaleNetFlowUsd ?? 0) > 0) { score += 14; reasons.push('Whales net accumulating'); }
    else if ((oc.whaleNetFlowUsd ?? 0) < 0) doNotTrade.push('Whales distributing — contradicts a long');

    if (score < 50) return abstain('On-chain flows not supportive enough');
    return {
      applicable: true,
      side: 'LONG',
      score: Math.min(80, score),
      reasons,
      doNotTrade,
      ...atrExit(entry.snapshot.price, entry.snapshot.atr14, 'LONG', 2.0, 2.5),
      entrySignal: 'On-chain accumulation confirming an uptrend',
      exitSignal: 'Flows reverse (inflows/distribution) or trailing stop',
      dataUsed: ['exchange flows', 'stablecoin inflows', 'whale flow', 'candles'],
    };
  },
};
