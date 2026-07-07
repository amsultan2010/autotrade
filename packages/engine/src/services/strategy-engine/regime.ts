/**
 * Market regime detector. The bot identifies the regime BEFORE choosing a
 * strategy, so only strategies suited to current conditions compete and unsafe
 * conditions short-circuit to "no trade".
 *
 * Detection is priority-ordered: the most decisive / most dangerous conditions
 * win first (liquidity & risk-off before trend reads), because the cheapest way
 * to avoid a bad trade is to recognise an unsafe tape early.
 */
import type { Timeframe } from '@autotrade/shared';
import type { MultiTimeframeAnalysis } from '../analysis/index';
import type { LiquidityContext, MarketContext, MarketRegime, NewsContext } from './types';
import { atrPct, isDowntrend, isUptrend, relVolume } from './helpers';

export interface RegimeInput {
  analysis: MultiTimeframeAnalysis;
  biasTf: Timeframe;
  entryTf: Timeframe;
  isCrypto: boolean;
  market?: MarketContext;
  news?: NewsContext;
  liquidity?: LiquidityContext;
  /** Volatility band thresholds (ATR% of price). Defaults are sensible for equities. */
  highVolAtrPct?: number; // default 4
  lowVolAtrPct?: number; // default 0.6
}

export interface RegimeResult {
  regime: MarketRegime;
  reasons: string[];
}

/** Is liquidity unsafe to trade? Wide spread or thin volume. */
function liquidityUnsafe(liq: LiquidityContext | undefined): boolean {
  if (!liq) return false;
  if (liq.spreadPct != null && liq.spreadPct > 1.0) return true; // >1% spread
  if (liq.relativeVolume != null && liq.relativeVolume < 0.3) return true; // very thin
  if (liq.avgDollarVolume != null && liq.avgDollarVolume < 1_000_000) return true; // <$1M/day
  return false;
}

function newsDriven(news: NewsContext | undefined): boolean {
  if (!news) return false;
  if (news.abnormalVolume) return true;
  if (news.earningsWithinHours != null && news.earningsWithinHours <= 24) return true;
  // A burst of fresh, strongly-toned headlines in the last few hours.
  const recent = news.items.filter((n) => Date.now() - n.publishedAt < 6 * 3_600_000);
  const strong = recent.filter((n) => Math.abs(n.sentiment) >= 0.5);
  return recent.length >= 3 || strong.length >= 1;
}

function marketRiskOff(market: MarketContext | undefined): boolean {
  if (!market) return false;
  if (market.riskOff) return true;
  // Require multiple stress signals — a mildly red index day alone should not halt all entries.
  const indicesWeak = market.spyTrend === 'DOWN' && market.qqqTrend === 'DOWN';
  const volStress = market.vix != null && market.vix >= 32;
  const breadthStress = market.breadthPct != null && market.breadthPct < 22;
  if (volStress && indicesWeak) return true;
  if (breadthStress && indicesWeak) return true;
  return false;
}

export function detectRegime(input: RegimeInput): RegimeResult {
  const reasons: string[] = [];
  const bias = input.analysis[input.biasTf];
  const entry = input.analysis[input.entryTf];

  // No data → can't form a view; treat as conflicting (no-trade default).
  if (!bias || !entry) {
    return { regime: 'CONFLICTING', reasons: ['Insufficient multi-timeframe data'] };
  }

  // 1) Liquidity gate first — never trade an untradeable tape (stocks only).
  if (!input.isCrypto && liquidityUnsafe(input.liquidity)) {
    return { regime: 'LOW_LIQUIDITY', reasons: ['Spread too wide or volume too thin to trade safely'] };
  }

  // 2) Market-wide risk-off overrides single-name optimism (stocks).
  if (!input.isCrypto && marketRiskOff(input.market)) {
    return { regime: 'RISK_OFF', reasons: ['Market-wide risk-off (index trend / VIX / breadth)'] };
  }

  // 3) News/event regime — price action becomes unreliable; trade with caution.
  if (newsDriven(input.news)) {
    return { regime: 'NEWS_EVENT', reasons: ['Event/news-driven tape — elevated uncertainty'] };
  }

  const biasUp = isUptrend(bias);
  const biasDown = isDowntrend(bias);
  const entryUp = isUptrend(entry);
  const entryDown = isDowntrend(entry);
  const adx = bias.extra.adx;
  const vol = atrPct(entry);
  const highVol = input.highVolAtrPct ?? 4;
  const lowVol = input.lowVolAtrPct ?? 0.6;

  // 4) Conflicting timeframes → default no-trade.
  if ((biasUp && entryDown) || (biasDown && entryUp)) {
    return {
      regime: 'CONFLICTING',
      reasons: [`Higher timeframe (${input.biasTf}) and entry (${input.entryTf}) disagree on direction`],
    };
  }

  // 5) Strong directional trend (aligned EMAs + real ADX strength).
  if (biasUp && adx >= 25) {
    reasons.push(`Aligned uptrend on ${input.biasTf} with ADX ${adx.toFixed(0)}`);
    return { regime: 'STRONG_UPTREND', reasons };
  }
  if (biasDown && adx >= 25) {
    reasons.push(`Aligned downtrend on ${input.biasTf} with ADX ${adx.toFixed(0)}`);
    return { regime: 'STRONG_DOWNTREND', reasons };
  }

  // 6) Breakout setup — volatility compression near a structural level on rising volume.
  const e = entry.snapshot;
  const compressed = vol > 0 && vol < lowVol * 1.6;
  const nearRes = e.resistance != null && e.price >= e.resistance * 0.99;
  const nearSup = e.support != null && e.price <= e.support * 1.01;
  if (compressed && (nearRes || nearSup) && relVolume(entry) >= 1.2) {
    reasons.push('Volatility compression into a structural level with rising volume');
    return { regime: 'BREAKOUT_SETUP', reasons };
  }

  // 7) Volatility bands.
  if (vol >= highVol) {
    reasons.push(`High volatility (ATR ${vol.toFixed(1)}% of price)`);
    return { regime: 'HIGH_VOLATILITY', reasons };
  }
  if (vol > 0 && vol <= lowVol) {
    reasons.push(`Low volatility (ATR ${vol.toFixed(1)}% of price)`);
    return { regime: 'LOW_VOLATILITY', reasons };
  }

  // 8) Default: range-bound / no decisive trend.
  reasons.push(`No decisive trend (ADX ${adx.toFixed(0)}) — treating as range-bound`);
  return { regime: 'RANGING', reasons };
}

// Human regime labels are centralized in types.ts (stock + crypto).
export { regimeLabel } from './types';
