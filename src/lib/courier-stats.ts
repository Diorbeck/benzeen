// Courier delivery stats (Курьер 2.0 /stats). Pure helpers so the computation
// is unit-testable without a DB; the bot webhook fetches the rows and formats.

// Tashkent is UTC+5 year-round (no DST), matching formatDeliveryTime elsewhere.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal shape of a delivered order needed to compute stats. */
export interface DeliveryRow {
  deliveredAt: Date | null;
  takenAt: Date | null;
  dispensedVolume: number | null;
}

export interface StatBucket {
  count: number;
  liters: number;
  // Average TAKE→DELIVERED time, in ms, over rows that have BOTH timestamps.
  // null when no such row exists (avoid fabricating a number from partial data).
  avgTakeToDeliverMs: number | null;
}

/** Start of "today" in Tashkent local time, as a UTC Date. */
export function startOfTashkentDay(now: Date = new Date()): Date {
  const shifted = now.getTime() + TASHKENT_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(dayStart - TASHKENT_OFFSET_MS);
}

/** Inclusive start of the last-7-days window (start of today − 6 days). */
export function startOfLast7Days(now: Date = new Date()): Date {
  return new Date(startOfTashkentDay(now).getTime() - 6 * DAY_MS);
}

/**
 * Aggregates a set of delivered rows: count, total liters, and the average
 * TAKE→DELIVERED time (only over rows that carry both timestamps). Rows without
 * a deliveredAt are ignored defensively.
 */
export function computeBucket(rows: DeliveryRow[]): StatBucket {
  let count = 0;
  let liters = 0;
  let sumMs = 0;
  let timed = 0;
  for (const r of rows) {
    if (!r.deliveredAt) continue;
    count += 1;
    liters += r.dispensedVolume ?? 0;
    if (r.takenAt) {
      sumMs += r.deliveredAt.getTime() - r.takenAt.getTime();
      timed += 1;
    }
  }
  return { count, liters, avgTakeToDeliverMs: timed > 0 ? Math.round(sumMs / timed) : null };
}

/** Human-readable duration, e.g. "23 мин" or "1 ч 05 мин". null → "—". */
export function formatAvgDuration(ms: number | null): string {
  if (ms == null) return '—';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} ч ${String(m).padStart(2, '0')} мин`;
  return `${m} мин`;
}
