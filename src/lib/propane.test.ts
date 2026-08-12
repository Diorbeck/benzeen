import { describe, expect, it } from 'vitest';
import {
  PROPANE_SLOT_MINUTES,
  bookSlotTx,
  bookableSlots,
  canOperateBooking,
  resolveOperatorAction,
  firstBookableSlot,
  isSlotAligned,
  makeBookingCode,
  SlotFullError,
  validateSlot,
  type BookingTx,
} from './propane';

const SLOT_MS = PROPANE_SLOT_MINUTES * 60 * 1000;

describe('slot math', () => {
  it('aligns the first bookable slot to a 15-minute boundary after the lead', () => {
    const now = new Date('2026-08-12T10:03:00Z');
    const first = firstBookableSlot(now);
    expect(isSlotAligned(first)).toBe(true);
    expect(first.getTime()).toBeGreaterThanOrEqual(now.getTime() + 10 * 60 * 1000);
    expect(first.toISOString()).toBe('2026-08-12T10:15:00.000Z');
  });

  it('generates consecutive slots up to the 24h horizon', () => {
    const now = new Date('2026-08-12T00:00:00Z');
    const slots = bookableSlots(now);
    expect(slots.length).toBeGreaterThan(90);
    expect(slots.length).toBeLessThanOrEqual(97);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].getTime() - slots[i - 1].getTime()).toBe(SLOT_MS);
    }
  });

  it('validates alignment, lead and horizon', () => {
    const now = new Date('2026-08-12T10:00:00Z');
    expect(validateSlot(new Date('2026-08-12T10:07:00Z'), now)).toEqual({
      ok: false,
      reason: 'not_aligned',
    });
    expect(validateSlot(new Date('2026-08-12T10:00:00Z'), now)).toEqual({
      ok: false,
      reason: 'too_soon',
    });
    expect(validateSlot(new Date('2026-08-14T10:00:00Z'), now)).toEqual({
      ok: false,
      reason: 'too_far',
    });
    expect(validateSlot(new Date('2026-08-12T12:30:00Z'), now)).toEqual({ ok: true });
  });
});

describe('booking code', () => {
  it('is human-safe: P- prefix, 6 chars, no ambiguous glyphs', () => {
    const code = makeBookingCode();
    expect(code).toMatch(/^P-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe('canOperateBooking (review fix: operator bound to their point)', () => {
  it('operator of a FOREIGN point is denied — route answers 404', () => {
    expect(
      canOperateBooking({ role: 'PROPANE_OPERATOR', userId: 'op-1', pointOperatorId: 'op-2' }),
    ).toBe(false);
  });

  it('operator of their own point is allowed', () => {
    expect(
      canOperateBooking({ role: 'PROPANE_OPERATOR', userId: 'op-1', pointOperatorId: 'op-1' }),
    ).toBe(true);
  });

  it('unassigned point (operatorId null) is admin-only', () => {
    expect(
      canOperateBooking({ role: 'PROPANE_OPERATOR', userId: 'op-1', pointOperatorId: null }),
    ).toBe(false);
    expect(canOperateBooking({ role: 'SUPER_ADMIN', userId: 'a1', pointOperatorId: null })).toBe(true);
  });

  it('SUPER_ADMIN serves any point; other roles never do', () => {
    expect(canOperateBooking({ role: 'SUPER_ADMIN', userId: 'a1', pointOperatorId: 'op-2' })).toBe(true);
    expect(canOperateBooking({ role: 'CLIENT', userId: 'op-1', pointOperatorId: 'op-1' })).toBe(false);
    expect(canOperateBooking({ role: undefined, userId: 'op-1', pointOperatorId: 'op-1' })).toBe(false);
  });
});

describe('resolveOperatorAction (serve / no-show transitions)', () => {
  it('no-show: оператор чужой точки → 404 (not_found)', () => {
    expect(
      resolveOperatorAction({
        role: 'PROPANE_OPERATOR',
        userId: 'op-1',
        booking: { status: 'BOOKED', pointOperatorId: 'op-2' },
      }),
    ).toBe('not_found');
  });

  it('missing booking → not_found; own point BOOKED → ok', () => {
    expect(resolveOperatorAction({ role: 'PROPANE_OPERATOR', userId: 'op-1', booking: null })).toBe(
      'not_found',
    );
    expect(
      resolveOperatorAction({
        role: 'PROPANE_OPERATOR',
        userId: 'op-1',
        booking: { status: 'BOOKED', pointOperatorId: 'op-1' },
      }),
    ).toBe('ok');
  });

  it('non-BOOKED states are not transitionable (409), даже для админа', () => {
    for (const status of ['SERVED', 'CANCELLED', 'NO_SHOW']) {
      expect(
        resolveOperatorAction({ role: 'SUPER_ADMIN', userId: 'a1', booking: { status, pointOperatorId: null } }),
      ).toBe('not_transitionable');
    }
  });
});

describe('bookSlotTx capacity (the 409 rule)', () => {
  const point = { pointId: 'pt1', clientId: 'c1', slotStart: new Date('2026-08-12T12:00:00Z') };

  function fakeTx(initialBooked: number): BookingTx & { created: number } {
    let booked = initialBooked;
    const state = {
      created: 0,
      async countBooked() {
        return booked;
      },
      async createBooking(d: { code: string }) {
        booked += 1;
        state.created += 1;
        return { id: `b${booked}`, code: d.code };
      },
    };
    return state as BookingTx & { created: number };
  }

  it('books while free posts remain', async () => {
    const tx = fakeTx(1);
    const res = await bookSlotTx(tx, { ...point, postsCount: 2, code: 'P-AAAAAA' });
    expect(res.id).toBe('b2');
    expect(tx.created).toBe(1);
  });

  it('throws SlotFullError when capacity is reached — route answers 409', async () => {
    const tx = fakeTx(2);
    await expect(
      bookSlotTx(tx, { ...point, postsCount: 2, code: 'P-BBBBBB' }),
    ).rejects.toBeInstanceOf(SlotFullError);
    expect(tx.created).toBe(0);
  });

  it('serial race: of N concurrent attempts only postsCount survive', async () => {
    // Emulates what Serializable isolation guarantees: the pairs run one
    // after another; the capacity check must stop exactly at postsCount.
    const tx = fakeTx(0);
    const results: Array<'ok' | 'full'> = [];
    for (let i = 0; i < 5; i++) {
      try {
        await bookSlotTx(tx, { ...point, clientId: `c${i}`, postsCount: 3, code: `P-CCCCC${i}` });
        results.push('ok');
      } catch (e) {
        results.push(e instanceof SlotFullError ? 'full' : 'ok');
      }
    }
    expect(results.filter((r) => r === 'ok')).toHaveLength(3);
    expect(tx.created).toBe(3);
  });
});
