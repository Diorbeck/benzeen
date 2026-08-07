// Pure bonus-liters math (M5 + PR-C protection). Money-adjacent, so kept
// separate + unit-tested; the server is the only place these are applied to an
// order total. PR-C adds a POSTED/PENDING/REJECTED lifecycle: ONLY POSTED rows
// count toward the balance and the "10 friends" milestone.

export const FRIEND_FIRST_ORDER_BONUS = 1; // +1 л to referrer on friend's 1st delivery
export const TEN_FRIENDS_BONUS = 10; // +10 л milestone
export const TEN_FRIENDS_AT = 10; // referred friends needed for the milestone

// PR-C rate-cap: at most this many POSTED FRIEND_FIRST_ORDER accruals per
// referrer per UTC calendar day. The (cap+1)th lands as PENDING for admin review.
export const FRIEND_FIRST_ORDER_DAILY_CAP = 3;

export type LedgerStatus = 'POSTED' | 'PENDING' | 'REJECTED';

// A ledger row for balance math. `status` is optional so pre-PR-C rows (and
// existing tests) are treated as POSTED — matching the additive migration that
// defaults every existing row to POSTED.
export type LedgerRow = { liters: number; reason: string; status?: LedgerStatus };

/** True when a row is counted toward the balance/milestone (POSTED, or legacy undefined). */
export function isPosted(row: { status?: LedgerStatus }): boolean {
  return row.status === undefined || row.status === 'POSTED';
}

/**
 * Liters that may be applied to an order. Capped by the balance and by
 * (volume − 1) so the client always pays for at least 1 liter. Never negative.
 */
export function computeBonusUsed(balance: number, volume: number): number {
  const b = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
  const v = Number.isFinite(volume) ? Math.max(0, Math.floor(volume)) : 0;
  const maxByVolume = Math.max(0, v - 1);
  return Math.max(0, Math.min(b, maxByVolume));
}

/**
 * PR-C: bonus liters a client may actually spend on an order. A frozen user can
 * never deduct bonus — the balance stays visible but is unusable. This is the
 * single gate the order-flow spend path must go through.
 */
export function spendableBonus(frozen: boolean, balance: number, volume: number): number {
  if (frozen) return 0;
  return computeBonusUsed(balance, volume);
}

/** Order total after bonus: (volume − bonusUsed) × pricePerLiter, floored at 0. */
export function computeTotal(volume: number, bonusUsed: number, pricePerLiter: number): number {
  const v = Number.isFinite(volume) ? volume : 0;
  const used = Number.isFinite(bonusUsed) ? bonusUsed : 0;
  const ppl = Number.isFinite(pricePerLiter) ? pricePerLiter : 0;
  return Math.max(0, v - used) * Math.max(0, ppl);
}

/**
 * Balance from ledger rows (positive liters; SPENT subtracts). Never negative.
 * PR-C: ONLY POSTED rows count — PENDING/REJECTED are excluded entirely.
 */
export function bonusBalanceFrom(rows: LedgerRow[]): number {
  let bal = 0;
  for (const r of rows) {
    if (!isPosted(r)) continue;
    bal += r.reason === 'SPENT' ? -r.liters : r.liters;
  }
  return Math.max(0, bal);
}

/**
 * Count of POSTED FRIEND_FIRST_ORDER rows — this is what drives the "10 friends"
 * milestone. PENDING/REJECTED accruals do NOT advance the milestone (PR-C).
 */
export function postedFriendFirstOrderCount(rows: LedgerRow[]): number {
  let n = 0;
  for (const r of rows) {
    if (r.reason === 'FRIEND_FIRST_ORDER' && isPosted(r)) n++;
  }
  return n;
}

/**
 * PR-C rate-cap decision for a NEW FRIEND_FIRST_ORDER accrual: given how many
 * POSTED FRIEND_FIRST_ORDER rows the referrer already has dated *today* (UTC),
 * the 1st…cap accruals are POSTED and the (cap+1)th onward are PENDING.
 */
export function accrualStatusForDay(
  todayPostedCount: number,
  cap: number = FRIEND_FIRST_ORDER_DAILY_CAP,
): LedgerStatus {
  return todayPostedCount >= cap ? 'PENDING' : 'POSTED';
}

/** UTC calendar-day window [start, nextDay) for a given instant. */
export function utcDayRange(at: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
