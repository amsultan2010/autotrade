/**
 * Trading strategies. Each inspects the multi-timeframe analysis and, if its
 * setup is present, returns a raw confidence score (0–100), a direction, and
 * the specific reasons that fired. Strategies are deterministic and auditable;
 * the decision engine applies per-user learning weights on top (req #9, #10).
 */
import type { StrategyId, Timeframe, TradeSide } from '@autotrade/shared';
import type { MultiTimeframeAnalysis, TimeframeAnalysis } from '../analysis/index.js';

export interface StrategyResult {
  strategy: StrategyId;
  side: TradeSide;
  rawScore: number; // 0–100 before learning weight
  reasons: string[];
}

export interface StrategyContext {
  analysis: MultiTimeframeAnalysis;
  biasTf: Timeframe; // higher timeframe for trend bias
  entryTf: Timeframe; // lower timeframe for the entry trigger
  isCrypto: boolean;
}

type Strategy = (ctx: StrategyContext) => StrategyResult | null;

/** Fastest available timeframe analysis — crypto momentum lives on low TFs. */
const FAST_ORDER: Timeframe[] = ['5m', '15m', '1h', '1m', '1d'];
function pickFast(analysis: MultiTimeframeAnalysis): TimeframeAnalysis | null {
  for (const tf of FAST_ORDER) if (analysis[tf]) return analysis[tf]!;
  return null;
}

function isUptrend(a: TimeframeAnalysis): boolean {
  const s = a.snapshot;
  return s.ema9 > s.ema21 && s.ema21 > s.sma50;
}
function isDowntrend(a: TimeframeAnalysis): boolean {
  const s = a.snapshot;
  return s.ema9 < s.ema21 && s.ema21 < s.sma50;
}

/** Trend breakout: established trend + price breaking structure on volume. */
const trendBreakout: Strategy = ({ analysis, biasTf, entryTf }) => {
  const bias = analysis[biasTf];
  const entry = analysis[entryTf];
  if (!bias || !entry) return null;

  const reasons: string[] = [];
  let score = 0;
  const e = entry.snapshot;

  if (isUptrend(bias)) {
    score += 25;
    reasons.push(`Higher-timeframe (${biasTf}) uptrend: EMA9>EMA21>SMA50`);
  } else if (isDowntrend(bias)) {
    score += 25;
    reasons.push(`Higher-timeframe (${biasTf}) downtrend: EMA9<EMA21<SMA50`);
  } else {
    return null; // no clear trend → not this strategy's setup
  }
  const side: TradeSide = isUptrend(bias) ? 'LONG' : 'SHORT';

  if (entry.extra.adx >= 20) {
    score += 15;
    reasons.push(`Trend strength confirmed (ADX ${entry.extra.adx.toFixed(0)})`);
  }
  if (e.volume > e.avgVolume * 1.2) {
    score += 20;
    reasons.push('Breakout volume above 20-period average');
  }
  const macdAligned = side === 'LONG' ? e.macd.histogram > 0 : e.macd.histogram < 0;
  if (macdAligned) {
    score += 15;
    reasons.push('MACD histogram aligned with trend');
  }
  // Structural breakout on the entry timeframe.
  if (side === 'LONG' && e.resistance && e.price >= e.resistance * 0.999) {
    score += 25;
    reasons.push('Price breaking prior resistance');
  } else if (side === 'SHORT' && e.support && e.price <= e.support * 1.001) {
    score += 25;
    reasons.push('Price breaking prior support');
  }

  if (score < 40) return null;
  return { strategy: 'TrendBreakout', side, rawScore: Math.min(100, score), reasons };
};

/** Pullback continuation: trend intact, price pulled back to EMA21 and resuming. */
const pullbackContinuation: Strategy = ({ analysis, biasTf, entryTf }) => {
  const bias = analysis[biasTf];
  const entry = analysis[entryTf];
  if (!bias || !entry) return null;
  const e = entry.snapshot;

  const up = isUptrend(bias);
  const down = isDowntrend(bias);
  if (!up && !down) return null;
  const side: TradeSide = up ? 'LONG' : 'SHORT';

  const reasons: string[] = [];
  let score = 20;
  reasons.push(`Trend intact on ${biasTf}; looking for a pullback entry`);

  const nearEma21 = Math.abs(e.price - e.ema21) / e.price < 0.01;
  if (nearEma21) {
    score += 25;
    reasons.push('Price pulled back to the EMA21 (dynamic support/resistance)');
  } else {
    return null;
  }

  if (up && e.rsi14 >= 40 && e.rsi14 <= 55) {
    score += 20;
    reasons.push(`RSI reset to neutral (${e.rsi14.toFixed(0)}) — room to resume up`);
  } else if (down && e.rsi14 >= 45 && e.rsi14 <= 60) {
    score += 20;
    reasons.push(`RSI reset to neutral (${e.rsi14.toFixed(0)}) — room to resume down`);
  }

  if (up && entry.extra.bullishEngulfing) {
    score += 20;
    reasons.push('Bullish engulfing at the pullback');
  } else if (down && entry.extra.bearishEngulfing) {
    score += 20;
    reasons.push('Bearish engulfing at the pullback');
  }

  if (score < 50) return null;
  return { strategy: 'PullbackContinuation', side, rawScore: Math.min(100, score), reasons };
};

/** Mean reversion: stretched RSI into support/resistance, weak trend. */
const meanReversion: Strategy = ({ analysis, entryTf }) => {
  const entry = analysis[entryTf];
  if (!entry) return null;
  const e = entry.snapshot;
  const reasons: string[] = [];

  // Mean reversion works poorly in strong trends — penalize high ADX.
  const trendPenalty = entry.extra.adx > 30 ? 20 : 0;

  if (e.rsi14 <= 30) {
    let score = 45 - trendPenalty;
    reasons.push(`Oversold RSI (${e.rsi14.toFixed(0)})`);
    if (e.support && e.price <= e.support * 1.01) {
      score += 25;
      reasons.push('Price at/near support');
    }
    if (entry.extra.bullishEngulfing) {
      score += 15;
      reasons.push('Bullish reversal candle');
    }
    if (score < 40) return null;
    return { strategy: 'MeanReversion', side: 'LONG', rawScore: Math.min(100, score), reasons };
  }

  if (e.rsi14 >= 70) {
    let score = 45 - trendPenalty;
    reasons.push(`Overbought RSI (${e.rsi14.toFixed(0)})`);
    if (e.resistance && e.price >= e.resistance * 0.99) {
      score += 25;
      reasons.push('Price at/near resistance');
    }
    if (entry.extra.bearishEngulfing) {
      score += 15;
      reasons.push('Bearish reversal candle');
    }
    if (score < 40) return null;
    return { strategy: 'MeanReversion', side: 'SHORT', rawScore: Math.min(100, score), reasons };
  }

  return null;
};

/**
 * CryptoMomentum — crypto-tuned, LONG-only, fast-timeframe. Crypto moves
 * differently than stocks: it rewards momentum/volatility breakouts and sharp
 * oversold snap-backs rather than slow daily trends. Only runs on crypto.
 */
const cryptoMomentum: Strategy = ({ analysis, isCrypto }) => {
  if (!isCrypto) return null;
  const fast = pickFast(analysis);
  if (!fast) return null;
  const s = fast.snapshot;
  const x = fast.extra;
  const atrPct = s.price > 0 ? (s.atr14 / s.price) * 100 : 0;

  const shortUp = s.price > s.ema9 && s.ema9 > s.ema21;
  const oversold = s.rsi14 < 35;
  if (!shortUp && !oversold) return null; // crypto is long-only: need a bullish trigger

  const reasons: string[] = [];
  let score = 0;

  if (shortUp) {
    score += 24;
    reasons.push('Fast uptrend (price>EMA9>EMA21)');
    if (s.resistance && s.price >= s.resistance * 0.997) {
      score += 24;
      reasons.push('Breaking recent range high (momentum breakout)');
    }
    if (s.volume > s.avgVolume * 1.3) {
      score += 18;
      reasons.push('Volume surge confirming the move');
    }
    if (s.macd.histogram > 0) {
      score += 12;
      reasons.push('MACD momentum positive');
    }
    if (s.rsi14 >= 55 && s.rsi14 <= 72) {
      score += 12;
      reasons.push(`RSI in momentum zone (${s.rsi14.toFixed(0)})`);
    } else if (s.rsi14 > 78) {
      score -= 15; // too extended — fade the chase
      reasons.push('RSI overextended — trimming score');
    }
    if (atrPct >= 1.5) {
      score += 8;
      reasons.push('Volatility expanding');
    }
  } else {
    // Oversold snap-back — common in crypto sell-offs.
    score += 30;
    reasons.push(`Oversold snap-back setup (RSI ${s.rsi14.toFixed(0)})`);
    if (x.bullishEngulfing) {
      score += 22;
      reasons.push('Bullish reversal candle');
    }
    if (s.support && s.price <= s.support * 1.02) {
      score += 20;
      reasons.push('Bouncing off support');
    }
    if (s.macd.histogram > s.macd.signal) {
      score += 8;
      reasons.push('MACD turning up');
    }
  }

  if (score < 45) return null;
  return { strategy: 'CryptoMomentum', side: 'LONG', rawScore: Math.min(100, score), reasons };
};

export const STRATEGY_FNS: Record<StrategyId, Strategy> = {
  TrendBreakout: trendBreakout,
  PullbackContinuation: pullbackContinuation,
  MeanReversion: meanReversion,
  CryptoMomentum: cryptoMomentum,
};
