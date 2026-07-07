export type EquityTab = '1D' | '1W' | '1M' | '3M' | '1Y';

const TAB_MS: Record<EquityTab, number> = {
  '1D': 86_400_000,
  '1W': 7 * 86_400_000,
  '1M': 30 * 86_400_000,
  '3M': 90 * 86_400_000,
  '1Y': 365 * 86_400_000,
};

const TAB_TO_ALPACA: Record<EquityTab, '1D' | '1W' | '1M' | '3M' | '1A'> = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1A',
};

export function alpacaPeriodForTab(tab: EquityTab): '1D' | '1W' | '1M' | '3M' | '1A' {
  return TAB_TO_ALPACA[tab];
}

/** Format portfolio history timestamps for chart axis labels. */
export function formatHistoryLabels(timestamps: number[], tab: EquityTab, maxLabels = 6): string[] {
  if (timestamps.length === 0) return defaultChartLabels(tab, maxLabels);
  const step = Math.max(1, Math.floor((timestamps.length - 1) / (maxLabels - 1)));
  const labels: string[] = [];
  for (let i = 0; i < timestamps.length; i += step) {
    const d = new Date(timestamps[i]! * 1000);
    if (tab === '1D') {
      labels.push(d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }));
    } else if (tab === '1W') {
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    } else {
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }
  return labels.length >= 2 ? labels : defaultChartLabels(tab, maxLabels);
}

function defaultChartLabels(tab: EquityTab, count: number): string[] {
  if (tab === '1D') return ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM'].slice(0, count);
  if (tab === '1W') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, count);
  return Array.from({ length: count }, (_, i) => `P${i + 1}`);
}

/** Simulator / trade-history equity curve ending at current account equity. */
export function buildSimulatorEquityCurve(
  currentEquity: number,
  trades: Array<{ closedAt?: number; pnl?: number }>,
  tab: EquityTab,
  points = 60,
): number[] {
  const now = Date.now();
  const windowMs = TAB_MS[tab];
  const startTime = now - windowMs;

  const closed = trades
    .filter((t) => t.closedAt != null && t.pnl != null && (t.closedAt ?? 0) >= startTime)
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));

  const pnlInWindow = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const startEquity = currentEquity - pnlInWindow;

  if (closed.length === 0) {
    return Array(points).fill(currentEquity > 0 ? currentEquity : startEquity) as number[];
  }

  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = startTime + (i / Math.max(points - 1, 1)) * windowMs;
    const pnlToT = closed
      .filter((tr) => (tr.closedAt ?? 0) <= t)
      .reduce((s, tr) => s + (tr.pnl ?? 0), 0);
    result.push(startEquity + pnlToT);
  }
  result[result.length - 1] = currentEquity;
  return result;
}

/** Cumulative closed-trade PnL for performance sparkline. */
export function buildCumulativePnlSeries(
  trades: Array<{ closedAt?: number; pnl?: number }>,
  maxPoints = 24,
): number[] {
  const closed = trades
    .filter((t) => t.closedAt != null && t.pnl != null)
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));

  if (closed.length === 0) return [];

  let running = 0;
  const series = closed.map((t) => {
    running += t.pnl ?? 0;
    return running;
  });

  if (series.length <= maxPoints) return series;

  const result: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * (series.length - 1));
    result.push(series[idx] ?? 0);
  }
  return result;
}

/** Recent signal confidence values (oldest → newest) for trend sparkline. */
export function buildConfidenceTrend(signals: Array<{ confidence: number; createdAt: number }>, max = 14): number[] {
  const sorted = [...signals].sort((a, b) => a.createdAt - b.createdAt);
  const slice = sorted.slice(-max);
  return slice.map((s) => s.confidence);
}

function isBullishSignal(action: string): boolean {
  return action === 'BUY';
}

function isBearishSignal(action: string): boolean {
  return action === 'SELL' || action === 'SHORT';
}

export function averageSignalConfidence(signals: Array<{ confidence: number; action: string }>): number {
  const actionable = signals.filter((s) => isBullishSignal(s.action) || isBearishSignal(s.action));
  const pool = actionable.length > 0 ? actionable : signals;
  if (pool.length === 0) return 0;
  return Math.round(pool.reduce((s, sig) => s + sig.confidence, 0) / pool.length);
}

export function signalRegime(signals: Array<{ action: string }>): 'Bullish' | 'Neutral' | 'Bearish' {
  const recent = signals.slice(0, 12);
  if (recent.length === 0) return 'Neutral';
  const buys = recent.filter((s) => isBullishSignal(s.action)).length;
  const sells = recent.filter((s) => isBearishSignal(s.action)).length;
  const ratio = buys / Math.max(buys + sells, 1);
  if (ratio >= 0.6) return 'Bullish';
  if (ratio <= 0.35) return 'Bearish';
  return 'Neutral';
}
