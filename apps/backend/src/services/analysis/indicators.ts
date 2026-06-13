/**
 * Indicator computation over a candle series. Wraps `technicalindicators`
 * and returns the latest value of each, plus structural reads (support /
 * resistance, average volume, simple candlestick patterns).
 *
 * Chart structure — not just last price (req #8).
 */
import {
  ADX,
  ATR,
  EMA,
  MACD,
  RSI,
  SMA,
  bearishengulfingpattern,
  bullishengulfingpattern,
} from 'technicalindicators';
import type { Candle, IndicatorSnapshot, Timeframe } from '@alphabot/shared';

function last<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined;
}

function lastEma(values: number[], period: number): number {
  const out = EMA.calculate({ period, values });
  return last(out) ?? (last(values) ?? 0);
}

function lastSma(values: number[], period: number): number {
  if (values.length < period) return last(values) ?? 0;
  const out = SMA.calculate({ period, values });
  return last(out) ?? (last(values) ?? 0);
}

/** Recent swing high/low as a pragmatic support/resistance read. */
function supportResistance(candles: Candle[], lookback = 30): { support: number | null; resistance: number | null } {
  const window = candles.slice(-lookback);
  if (window.length < 5) return { support: null, resistance: null };
  const support = Math.min(...window.map((c) => c.l));
  const resistance = Math.max(...window.map((c) => c.h));
  return { support, resistance };
}

export interface ExtraReads {
  adx: number; // trend strength
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
}

export function computeSnapshot(
  timeframe: Timeframe,
  candles: Candle[],
): { snapshot: IndicatorSnapshot; extra: ExtraReads } | null {
  // Need enough history for the slow indicators to be meaningful.
  if (candles.length < 30) return null;

  const close = candles.map((c) => c.c);
  const high = candles.map((c) => c.h);
  const low = candles.map((c) => c.l);
  const volume = candles.map((c) => c.v);

  const price = last(close)!;

  const macdSeries = MACD.calculate({
    values: close,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdLast = last(macdSeries);

  const rsiSeries = RSI.calculate({ period: 14, values: close });
  const atrSeries = ATR.calculate({ period: 14, high, low, close });
  const adxSeries = ADX.calculate({ period: 14, high, low, close });

  const { support, resistance } = supportResistance(candles);
  const avgVolume = volume.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volume.length);

  const snapshot: IndicatorSnapshot = {
    timeframe,
    price,
    ema9: lastEma(close, 9),
    ema21: lastEma(close, 21),
    sma50: lastSma(close, 50),
    sma200: lastSma(close, 200),
    rsi14: last(rsiSeries) ?? 50,
    macd: {
      macd: macdLast?.MACD ?? 0,
      signal: macdLast?.signal ?? 0,
      histogram: macdLast?.histogram ?? 0,
    },
    atr14: last(atrSeries) ?? 0,
    support,
    resistance,
    volume: last(volume) ?? 0,
    avgVolume,
  };

  const extra: ExtraReads = {
    adx: last(adxSeries)?.adx ?? 0,
    bullishEngulfing: last(bullishengulfingpattern({ open: candles.map((c) => c.o), close, high, low })) ?? false,
    bearishEngulfing: last(bearishengulfingpattern({ open: candles.map((c) => c.o), close, high, low })) ?? false,
  };

  return { snapshot, extra };
}
