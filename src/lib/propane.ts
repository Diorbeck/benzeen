// M4 Propane: slot math + booking capacity rules.
// Pure functions here are unit-tested; the transaction body takes a minimal
// client interface so the 409 race behavior is testable without a database.

export const PROPANE_SLOT_MINUTES = 15;
/** How far ahead a slot can be booked. */
export const PROPANE_BOOK_AHEAD_MS = 24 * 60 * 60 * 1000;
/** Minimum lead before a slot starts (gives the client time to drive up). */
export const PROPANE_MIN_LEAD_MS = 10 * 60 * 1000;

const SLOT_MS = PROPANE_SLOT_MINUTES * 60 * 1000;

/** True when the date lies exactly on a slot boundary. */
export function isSlotAligned(d: Date): boolean {
  return d.getTime() % SLOT_MS === 0;
}

/** The first bookable slot start at or after `now` + lead. */
export function firstBookableSlot(now: Date): Date {
  const min = now.getTime() + PROPANE_MIN_LEAD_MS;
  return new Date(Math.ceil(min / SLOT_MS) * SLOT_MS);
}

/**
 * Bookable slot starts for a point, from `now` until the horizon.
 * Capped to one day of 15-minute slots (96 entries max).
 */
export function bookableSlots(now: Date): Date[] {
  const first = firstBookableSlot(now);
  const end = now.getTime() + PROPANE_BOOK_AHEAD_MS;
  const out: Date[] = [];
  for (let t = first.getTime(); t <= end; t += SLOT_MS) {
    out.push(new Date(t));
  }
  return out;
}

export type SlotValidity =
  | { ok: true }
  | { ok: false; reason: 'not_aligned' | 'too_soon' | 'too_far' };

/** Server-side validation of a requested slotStart. */
export function validateSlot(slotStart: Date, now: Date): SlotValidity {
  if (!isSlotAligned(slotStart)) return { ok: false, reason: 'not_aligned' };
  if (slotStart.getTime() < now.getTime() + PROPANE_MIN_LEAD_MS)
    return { ok: false, reason: 'too_soon' };
  if (slotStart.getTime() > now.getTime() + PROPANE_BOOK_AHEAD_MS)
    return { ok: false, reason: 'too_far' };
  return { ok: true };
}

/** Human-friendly booking code the operator reads back: P-7K3M9Q. */
export function makeBookingCode(rand: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return `P-${s}`;
}

// --- operator access (review fix: no cross-point serving) -------------------

/**
 * May this user act on a booking of a point? SUPER_ADMIN — always; an operator
 * only when the point is bound to them (NULL binding ⇒ admin-only). Routes
 * answer 404 on failure so foreign bookings are indistinguishable from
 * nonexistent ones.
 */
export function canOperateBooking(args: {
  role: string | undefined;
  userId: string;
  pointOperatorId: string | null;
}): boolean {
  if (args.role === 'SUPER_ADMIN') return true;
  if (args.role !== 'PROPANE_OPERATOR') return false;
  return args.pointOperatorId !== null && args.pointOperatorId === args.userId;
}

// --- capacity-checked booking (the 409 race rule) ---------------------------

export class SlotFullError extends Error {
  constructor() {
    super('slot_full');
  }
}

export type BookingTx = {
  countBooked(pointId: string, slotStart: Date): Promise<number>;
  createBooking(data: {
    pointId: string;
    clientId: string;
    slotStart: Date;
    code: string;
  }): Promise<{ id: string; code: string }>;
};

/**
 * Book one slot inside a transaction: capacity = the point's postsCount.
 * Throws SlotFullError when every post at that slot is already taken — the
 * route maps it (and the double-booking unique violation) to HTTP 409.
 * Run with Serializable isolation so two concurrent count+create pairs can't
 * both pass the check.
 */
export async function bookSlotTx(
  tx: BookingTx,
  args: { pointId: string; clientId: string; slotStart: Date; postsCount: number; code: string },
): Promise<{ id: string; code: string }> {
  const taken = await tx.countBooked(args.pointId, args.slotStart);
  if (taken >= args.postsCount) throw new SlotFullError();
  return tx.createBooking({
    pointId: args.pointId,
    clientId: args.clientId,
    slotStart: args.slotStart,
    code: args.code,
  });
}
