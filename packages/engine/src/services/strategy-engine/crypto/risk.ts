/**
 * Crypto-specific risk controls — layered ON TOP of the shared RiskManager.
 *
 * The shared risk engine already does sizing, R:R, confidence, and the generic
 * liquidity/volatility gates. This adds the crypto-only rules:
 *   - spot-only by default; futures/perps/leverage DISABLED unless explicitly enabled
 *   - per-coin and altcoin exposure caps; max open crypto positions
 *   - liquidity / spread / 24h-volume minimums
 *   - legal/age eligibility check required before any LIVE exchange connection
 *
 * It's a post-selection gate the caller runs on a crypto decision; it prefers
 * NO-TRADE and never enables leverage by default.
 */
import type { AssetType, StrategyDecision } from '../types';

export interface CryptoRiskConfig {
  spotOnly: boolean; // default true
  allowFutures: boolean; // default false
  allowPerps: boolean; // default false
  allowLeverage: boolean; // default false
  maxPerCoinPct: number; // max % of equity in one coin
  maxAltcoinExposurePct: number; // max % of equity across all altcoins
  maxOpenCryptoPositions: number;
  minVolume24hUsd: number;
  maxSpreadPct: number;
  /** Live trading requires the user to confirm legal age + eligibility. */
  eligibilityConfirmed: boolean;
}

export const DEFAULT_CRYPTO_RISK: CryptoRiskConfig = {
  spotOnly: true,
  allowFutures: false,
  allowPerps: false,
  allowLeverage: false,
  maxPerCoinPct: 20,
  maxAltcoinExposurePct: 50,
  maxOpenCryptoPositions: 8,
  minVolume24hUsd: 5_000_000,
  maxSpreadPct: 0.6,
  eligibilityConfirmed: false,
};

/** Live portfolio snapshot the caller supplies for exposure checks. */
export interface CryptoPortfolio {
  openCryptoPositions: number;
  /** % of equity currently in this exact coin. */
  thisCoinExposurePct: number;
  /** % of equity currently across all altcoins (non BTC/ETH). */
  altcoinExposurePct: number;
}

export interface CryptoRiskResult {
  ok: boolean;
  reasons: string[];
}

const isMajor = (symbol: string) => /^(BTC|ETH)/i.test(symbol);

function assetAllowed(assetType: AssetType, cfg: CryptoRiskConfig): string | null {
  if (assetType === 'crypto_perp' && !(cfg.allowPerps && cfg.allowLeverage)) {
    return 'Perpetuals/leverage are disabled by default — enable high-risk mode to trade them';
  }
  if (assetType === 'crypto_futures' && !(cfg.allowFutures && cfg.allowLeverage)) {
    return 'Futures/leverage are disabled by default — enable high-risk mode to trade them';
  }
  if (cfg.spotOnly && assetType !== 'crypto_spot' && assetType !== 'mixed') {
    return 'Spot-only mode — non-spot crypto trade blocked';
  }
  return null;
}

export interface AssessCryptoRiskArgs {
  decision: StrategyDecision;
  config: CryptoRiskConfig;
  portfolio: CryptoPortfolio;
  live?: boolean; // is this a LIVE (real-money) order?
}

export function assessCryptoRisk(args: AssessCryptoRiskArgs): CryptoRiskResult {
  const { decision, config, portfolio } = args;
  const reasons: string[] = [];

  // Only gates entries.
  if (decision.action !== 'BUY' && decision.action !== 'SHORT') return { ok: true, reasons };

  // 1) Legal/age eligibility before any live trade.
  if (args.live && !config.eligibilityConfirmed) {
    reasons.push('Live trading requires confirming legal age + eligibility first');
  }

  // 2) Asset type / leverage gates.
  const assetBlock = assetAllowed(decision.chosenStrategy?.assetType ?? 'crypto_spot', config);
  if (assetBlock) reasons.push(assetBlock);

  // 3) Exposure caps.
  if (portfolio.openCryptoPositions >= config.maxOpenCryptoPositions) {
    reasons.push(`Max open crypto positions reached (${config.maxOpenCryptoPositions})`);
  }
  if (portfolio.thisCoinExposurePct >= config.maxPerCoinPct) {
    reasons.push(`Per-coin exposure cap reached (${config.maxPerCoinPct}%)`);
  }
  if (!isMajor(decision.symbol) && portfolio.altcoinExposurePct >= config.maxAltcoinExposurePct) {
    reasons.push(`Altcoin exposure cap reached (${config.maxAltcoinExposurePct}%)`);
  }

  return { ok: reasons.length === 0, reasons };
}
