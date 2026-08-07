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
 * Converts an admin-supplied inclusive `from`/`to` date range (each a
 * "YYYY-MM-DD" string in Tashkent local time) into a half-open UTC window
 * `[start, end)` suitable for a `deliveredAt` filter. `end` is the start of the
 * day AFTER `to`, so the whole `to` day is included. Invalid/blank inputs fall
 * back to a single-day (today) window so callers never build a broken query.
 */
export function tashkentRangeToUtc(
  from: string | undefined | null,
  to: string | undefined | null,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const parse = (s: string | undefined | null): Date | null => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    // Tashkent local midnight expressed as a UTC instant.
    return new Date(Date.UTC(y, mo - 1, d) - TASHKENT_OFFSET_MS);
  };
  const today = startOfTashkentDay(now);
  const start = parse(from) ?? today;
  const toStart = parse(to) ?? today;
  // Half-open: include the full `to` day by ending at the next day's start.
  let end = new Date(toStart.getTime() + DAY_MS);
  if (end.getTime() <= start.getTime()) {
    // Guard against inverted ranges — collapse to a single-day window.
    end = new Date(start.getTime() + DAY_MS);
  }
  return { start, end };
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
