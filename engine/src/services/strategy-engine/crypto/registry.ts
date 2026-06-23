/**
 * Crypto strategy registry. To add a crypto strategy: create a file in
 * strategies/, import it here, and add it to CRYPTO_STRATEGIES. The shared
 * selector picks it up automatically (crypto strategies self-gate to crypto
 * assets), and it appears in the strategy catalog with its description.
 */
import type { Strategy } from '../types';
import { CryptoTrendFollowing } from './strategies/cryptoTrendFollowing';
import { CryptoMomentum } from './strategies/cryptoMomentum';
import { CryptoMeanReversion } from './strategies/cryptoMeanReversion';
import { CryptoBreakout } from './strategies/cryptoBreakout';
import { BtcEthLeader } from './strategies/btcEthLeader';
import { CryptoLiquidity } from './strategies/cryptoLiquidity';
import { FundingRatePerp } from './strategies/fundingRatePerp';
import { OpenInterestLiquidation } from './strategies/openInterestLiquidation';
import { OnChainFlow } from './strategies/onChainFlow';
import { CryptoNews } from './strategies/cryptoNews';

/** The 10 crypto strategy modules, in display order. */
export const CRYPTO_STRATEGIES: Strategy[] = [
  CryptoTrendFollowing,
  CryptoMomentum,
  CryptoMeanReversion,
  CryptoBreakout,
  BtcEthLeader, // overlay / master filter
  CryptoLiquidity, // overlay / safety filter
  FundingRatePerp, // experimental (perp/funding data)
  OpenInterestLiquidation, // experimental (OI/liquidation data)
  OnChainFlow, // experimental (on-chain data)
  CryptoNews, // experimental (news data)
];
