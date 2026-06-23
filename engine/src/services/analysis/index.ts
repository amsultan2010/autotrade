/**
 * AnalysisEngine — fetches real candles per timeframe and computes the
 * multi-timeframe indicator picture for a symbol. Pure analysis: it makes no
 * trading decision and never touches money (req #7 separation of concerns).
 */
import type { IndicatorSnapshot, Timeframe } from '@autotrade/shared';
import { getMarketData } from '../marketdata/index';
import { computeSnapshot, type ExtraReads } from './indicators';

const BAR_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86_400,
};

/** Candles to request per timeframe (enough for slow indicators + structure). */
const WANTED_BARS = 260;

export interface TimeframeAnalysis {
  snapshot: IndicatorSnapshot;
  extra: ExtraReads;
}

export type MultiTimeframeAnalysis = Partial<Record<Timeframe, TimeframeAnalysis>>;

export async function analyzeSymbol(
  symbol: string,
  timeframes: Timeframe[],
): Promise<MultiTimeframeAnalysis> {
  let md;
  try {
    md = getMarketData();
  } catch {
    return {};
  }
  const now = Math.floor(Date.now() / 1000);
  const result: MultiTimeframeAnalysis = {};

  await Promise.all(
    timeframes.map(async (tf) => {
      const from = now - BAR_SECONDS[tf] * WANTED_BARS;
      try {
        const candles = await md.getCandles(symbol, tf, from, now);
        const computed = computeSnapshot(tf, candles);
        if (computed) result[tf] = computed;
      } catch {
        // A single timeframe failing (e.g. provider gap) should not abort the
        // whole analysis; the decision engine handles missing timeframes.
      }
    }),
  );

  return result;
}
