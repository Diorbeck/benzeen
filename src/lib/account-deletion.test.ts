import { describe, expect, it } from 'vitest';
import {
  anonymizedUserData,
  deletionBlock,
  hardDeleteEligible,
  TERMINAL_ORDER_STATUSES,
} from './account-deletion';

describe('deletionBlock', () => {
  it('active order blocks first, then active booking, else null', () => {
    expect(deletionBlock({ activeOrders: 1, activeBookings: 0 })).toBe('active_order');
    expect(deletionBlock({ activeOrders: 0, activeBookings: 2 })).toBe('active_booking');
    expect(deletionBlock({ activeOrders: 1, activeBookings: 1 })).toBe('active_order');
    expect(deletionBlock({ activeOrders: 0, activeBookings: 0 })).toBeNull();
  });

  it('terminal statuses are exactly the non-blocking ones', () => {
    expect([...TERMINAL_ORDER_STATUSES].sort()).toEqual(
      ['CANCELLED', 'CLOSED', 'DELIVERED', 'REJECTED'].sort(),
    );
  });
});

describe('anonymizedUserData', () => {
  it('wipes PII, keeps unique constraints satisfiable, stamps deletedAt', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    const d = anonymizedUserData('u123', now);
    expect(d.phone).toBe('deleted:u123');
    expect(d.email).toBe('deleted-u123@clients.benzeen.local');
    expect(d.name).toBeNull();
    expect(d.lastName).toBeNull();
    expect(d.telegramId).toBeNull();
    expect(d.defaultCarId).toBeNull();
    expect(d.deletedAt).toBe(now);
  });

  it('two users anonymize to distinct phones/emails (unique-safe)', () => {
    const a = anonymizedUserData('a');
    const b = anonymizedUserData('b');
    expect(a.phone).not.toBe(b.phone);
    expect(a.email).not.toBe(b.email);
  });
});

describe('hardDeleteEligible', () => {
  it('only a zero-history account can be hard-deleted', () => {
    expect(hardDeleteEligible({ orders: 0, ledger: 0 })).toBe(true);
    expect(hardDeleteEligible({ orders: 1, ledger: 0 })).toBe(false);
    expect(hardDeleteEligible({ orders: 0, ledger: 3 })).toBe(false);
  });
});
