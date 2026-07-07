/**
 * 6. Open Interest / Liquidation-Risk (EXPERIMENTAL — needs OI/liquidation data).
 * Primarily a RISK REDUCER: when OI rises too fast while price is unstable, it
 * flags cascade risk and blocks/avoids. asset_type = crypto_perp (disabled by
 * default). Abstains when OI data is absent.
 */
import type { Strategy, StrategyContext, StrategyEvaluation } from '../../types';
import { abstain, atrPct } from '../../helpers';

export const OpenInterestLiquidation: Strategy = {
  internalName: 'crypto_oi_liquidation',
  displayName: 'Open Interest / Liquidation-Risk',
  description:
    'Watches open interest and liquidation risk to AVOID leverage-driven cascades. When OI spikes while price is volatile, it blocks or shrinks size. Perp/leverage strategy — disabled by default. Abstains without OI data.',
  source: 'experimental',
  assetType: 'crypto_perp',
  bestRegimes: ['CRYPTO_LIQUIDATION_RISK', 'CRYPTO_LEVERAGE_HEAVY'],
  avoidRegimes: ['CRYPTO_LOW_LIQUIDITY'],
  requiredInputs: ['Open interest + change', 'liquidation risk / heatmap (perp venue)'],
  indicators: ['open interest change', 'liquidation risk', 'volume spikes', 'funding extremes', 'volatility'],
  supports: { backtest: false, paper: true, live: true },

  evaluate(ctx: StrategyContext): StrategyEvaluation {
    if (!ctx.isCrypto) return abstain('Crypto-only strategy');
    const f = ctx.crypto?.funding;
    if (!f || (f.openInterestChangePct == null && f.liquidationRisk == null)) {
      return abstain('No open-interest / liquidation data available');
    }
    const entry = ctx.analysis[ctx.entryTf];
    if (!entry) return abstain('No entry-timeframe data');

    const doNotTrade: string[] = [];
    const reasons: string[] = [];
    const vol = atrPct(entry);

    if (f.liquidationRisk === 'high') doNotTrade.push('Liquidation risk HIGH — stand down');
    if (f.openInterestChangePct != null && Math.abs(f.openInterestChangePct) > 12 && vol >= 4) {
      doNotTrade.push(`OI spiking ${f.openInterestChangePct.toFixed(0)}% into ${vol.toFixed(1)}% volatility — cascade risk`);
    }

    // This module's job is to BLOCK dangerous tape, not to generate entries.
    if (doNotTrade.length > 0) {
      return { applicable: true, side: null, score: 0, reasons, doNotTrade, dataUsed: ['open interest', 'liquidation risk', 'ATR'] };
    }
    return abstain('Open interest / liquidation conditions are calm');
  },
};
