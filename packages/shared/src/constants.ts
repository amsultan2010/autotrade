/** Generous paper trade cap for free-tier users. */
export const FREE_PAPER_TRADE_LIMIT = 500;

/** Max simulated paper balance for free users. */
export const FREE_PAPER_BALANCE_CAP = 10_000;

/** Max trade executions per day for free paper users. */
export const FREE_DAILY_EXECUTION_LIMIT = 25;

/** Default simulated paper account starting balance (USD) — free tier capped separately. */
export const PAPER_STARTING_BALANCE = 100_000;

/** Default automatic scan interval (seconds) for free users (paper-only). */
export const DEFAULT_SCAN_INTERVAL_SECONDS = 44;

/** Slowest scan interval available (Essential max). */
export const MAX_SCAN_INTERVAL_SECONDS = 44;

/** Fastest scan interval available (Unlimited min). */
export const MIN_SCAN_INTERVAL_SECONDS = 1;

/** Every scan interval from 1s through 44s (1 sec steps). */
export const ALL_SCAN_INTERVALS = Array.from({ length: 44 }, (_, i) => i + 1) as readonly number[];

/** @deprecated Use ALL_SCAN_INTERVALS */
export const SELECTABLE_SCAN_INTERVAL_SECONDS = ALL_SCAN_INTERVALS;

/** @deprecated No longer used */
export const LOCKED_SCAN_INTERVAL_SECONDS = [] as const;

export type SelectableScanIntervalSeconds = number;

export function formatScanInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = seconds / 60;
  return mins === 1 ? '1 min' : `${mins} min`;
}

export function isValidScanInterval(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= MIN_SCAN_INTERVAL_SECONDS && seconds <= MAX_SCAN_INTERVAL_SECONDS;
}

/** @deprecated Use isValidScanInterval + plan entitlements */
export function isSelectableScanInterval(seconds: number): boolean {
  return isValidScanInterval(seconds);
}

export function normalizeScanInterval(seconds?: number): number {
  if (seconds != null && isValidScanInterval(seconds)) return seconds;
  return DEFAULT_SCAN_INTERVAL_SECONDS;
}

/** Start of ISO week (Monday UTC) as epoch ms. */
export function startOfUtcWeekMs(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}
