// Pure bonus-liters math (M5). Money-adjacent, so kept separate + unit-tested;
// the server is the only place these are applied to an order total.

export const FRIEND_FIRST_ORDER_BONUS = 1; // +1 л to referrer on friend's 1st delivery
export const TEN_FRIENDS_BONUS = 10; // +10 л milestone
export const TEN_FRIENDS_AT = 10; // referred friends needed for the milestone

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

/** Order total after bonus: (volume − bonusUsed) × pricePerLiter, floored at 0. */
export function computeTotal(volume: number, bonusUsed: number, pricePerLiter: number): number {
  const v = Number.isFinite(volume) ? volume : 0;
  const used = Number.isFinite(bonusUsed) ? bonusUsed : 0;
  const ppl = Number.isFinite(pricePerLiter) ? pricePerLiter : 0;
  return Math.max(0, v - used) * Math.max(0, ppl);
}

/** Balance from ledger rows (positive liters; SPENT subtracts). Never negative. */
export function bonusBalanceFrom(rows: { liters: number; reason: string }[]): number {
  let bal = 0;
  for (const r of rows) bal += r.reason === 'SPENT' ? -r.liters : r.liters;
  return Math.max(0, bal);
}
