/**
 * US equity session helpers. Trading-hours gates use America/New_York so
 * serverless hosts (UTC) match the NYSE regular session the user configures.
 */

const US_EASTERN = 'America/New_York';

/** Minutes since midnight in US Eastern (0–1439). */
export function minutesSinceMidnightEastern(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: US_EASTERN,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when `now` falls inside [start, end] (inclusive), in US Eastern. */
export function isWithinTradingHours(
  startHHMM: string,
  endHHMM: string,
  now = new Date(),
): boolean {
  const nowMin = minutesSinceMidnightEastern(now);
  const start = parseHHMM(startHHMM);
  const end = parseHHMM(endHHMM);
  return nowMin >= start && nowMin <= end;
}
