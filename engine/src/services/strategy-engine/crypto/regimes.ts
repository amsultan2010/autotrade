/**
 * Crypto market-regime detector. Runs BEFORE any crypto strategy so only
 * strategies suited to the current crypto tape compete — and unsafe tapes
 * (low liquidity, liquidation risk) short-circuit to a no-trade default.
 *
 * Priority order is "most dangerous first": liquidity → liquidation → leverage →
 * news → conflicting → trend → rotation → breakout → ranging.
 */
import type { Timeframe } from '@autotrade/shared';
import type { MultiTimeframeAnalysis } from '../../analysis/index';
import type { CryptoContext, CryptoRegime, LiquidityContext, NewsContext } from '../types';
import { atrPct, isDowntrend, isUptrend, relVolume } from '../helpers';

export interface CryptoRegimeInput {
  analysis: MultiTimeframeAnalysis;
  biasTf: Timeframe;
  entryTf: Timeframe;
  crypto?: CryptoContext;
  liquidity?: LiquidityContext;
  news?: NewsContext;
  highVolAtrPct?: number; // default 5 (crypto runs hotter than equities)
}

export interface CryptoRegimeResult {
  regime: CryptoRegime;
  reasons: string[];
}

function liquidityUnsafe(c?: CryptoContext, liq?: LiquidityContext): boolean {
  const ob = c?.orderBook;
  if (ob?.spreadPct != null && ob.spreadPct > 0.6) return true;
  if (ob?.volume24hUsd != null && ob.volume24hUsd < 5_000_000) return true; // < $5M/day
  if (ob?.slippageEstPct != null && ob.slippageEstPct > 1) return true;
  if (liq?.spreadPct != null && liq.spreadPct > 0.8) return true;
  if (liq?.relativeVolume != null && liq.relativeVolume < 0.3) return true;
  return false;
}

function liquidationRisk(c?: CryptoContext): boolean {
  const f = c?.funding;
  if (!f) return false;
  if (f.liquidationRisk === 'high') return true;
  // OI spiking fast while price is jumpy = cascade risk.
  if (f.openInterestChangePct != null && Math.abs(f.openInterestChangePct) > 15) return true;
  return false;
}

function leverageHeavy(c?: CryptoContext): boolean {
  const f = c?.funding;
  if (!f) return false;
  if (f.fundingRate != null && Math.abs(f.fundingRate) >= 0.0005) return true; // crowded
  if (f.longShortRatio != null && (f.longShortRatio > 2 || f.longShortRatio < 0.5)) return true;
  return false;
}

function newsDriven(news?: NewsContext): boolean {
  if (!news) return false;
  if (news.abnormalVolume) return true;
  const recent = news.items.filter((n) => Date.now() - n.publishedAt < 6 * 3_600_000);
  return recent.length >= 2 || recent.some((n) => Math.abs(n.sentiment) >= 0.5);
}

export function detectCryptoRegime(input: CryptoRegimeInput): CryptoRegimeResult {
  const bias = input.analysis[input.biasTf];
  const entry = input.analysis[input.entryTf];
  const c = input.crypto;
  const reasons: string[] = [];

  if (!bias || !entry) {
    return { regime: 'CRYPTO_CONFLICTING', reasons: ['Insufficient multi-timeframe data'] };
  }

  // 1) Liquidity / 2) liquidation / 3) leverage — never trade a dangerous tape blindly.
  if (liquidityUnsafe(c, input.liquidity)) {
    return { regime: 'CRYPTO_LOW_LIQUIDITY', reasons: ['Thin volume / wide spread — unsafe to trade'] };
  }
  if (liquidationRisk(c)) {
    return { regime: 'CRYPTO_LIQUIDATION_RISK', reasons: ['High liquidation risk (OI / funding extreme)'] };
  }
  if (leverageHeavy(c)) {
    return { regime: 'CRYPTO_LEVERAGE_HEAVY', reasons: ['Leverage-heavy positioning (crowded funding / L/S ratio)'] };
  }

  // 4) News/narrative tape.
  if (newsDriven(input.news)) {
    return { regime: 'CRYPTO_NEWS_DRIVEN', reasons: ['News / narrative-driven move'] };
  }

  const biasUp = isUptrend(bias);
  const biasDown = isDowntrend(bias);
  const entryUp = isUptrend(entry);
  const entryDown = isDowntrend(entry);
  const adx = bias.extra.adx;
  const vol = atrPct(entry);
  const highVol = input.highVolAtrPct ?? 5;

  // 5) Conflicting timeframes, or this coin fighting BTC → default no-trade.
  if ((biasUp && entryDown) || (biasDown && entryUp)) {
    return { regime: 'CRYPTO_CONFLICTING', reasons: ['Higher and entry timeframes disagree on direction'] };
  }
  if (c?.btcTrend === 'DOWN' && biasUp) {
    return { regime: 'CRYPTO_CONFLICTING', reasons: ['Coin bid while BTC is falling — conflicting'] };
  }

  // 6) BTC-led trend (use BTC context if present, else this coin's own trend).
  const leaderUp = c?.btcTrend ? c.btcTrend === 'UP' : biasUp;
  const leaderDown = c?.btcTrend ? c.btcTrend === 'DOWN' : biasDown;
  if (leaderUp && biasUp && adx >= 22) {
    reasons.push(`BTC-led uptrend (ADX ${adx.toFixed(0)})`);
    return { regime: 'BTC_LED_UPTREND', reasons };
  }
  if (leaderDown && biasDown && adx >= 22) {
    reasons.push(`BTC-led downtrend (ADX ${adx.toFixed(0)})`);
    return { regime: 'BTC_LED_DOWNTREND', reasons };
  }

  // 7) Altcoin rotation: BTC stable/flat but this alt is outperforming.
  if (c && (c.btcTrend === 'FLAT' || c.btcTrend === 'UP') && (c.strengthVsBtc ?? 0) > 0.2 && biasUp) {
    reasons.push('Altcoin outperforming a stable BTC (rotation)');
    return { regime: 'ALTCOIN_ROTATION', reasons };
  }

  // 8) High-volatility breakout.
  const e = entry.snapshot;
  const nearLevel =
    (e.resistance != null && e.price >= e.resistance * 0.99) ||
    (e.support != null && e.price <= e.support * 1.01);
  if (vol >= highVol && nearLevel && relVolume(entry) >= 1.3) {
    reasons.push(`High-volatility breakout (ATR ${vol.toFixed(1)}%)`);
    return { regime: 'CRYPTO_HIGH_VOL_BREAKOUT', reasons };
  }

  // 9) Default: range-bound.
  reasons.push(`No decisive crypto trend (ADX ${adx.toFixed(0)}) — ranging`);
  return { regime: 'CRYPTO_RANGING', reasons };
}
