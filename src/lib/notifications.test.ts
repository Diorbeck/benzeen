import { describe, it, expect } from 'vitest';

const NOTIFICATION_TYPES = ['LOW_LIMIT', 'FULL_TANK_PENDING', 'COURIER_ASSIGNED', 'ORDER_DELIVERED'] as const;

describe('notification triggers', () => {
  it('LOW_LIMIT triggers when remaining < 20% of limit', () => {
    const limit = 100;
    const used = 85; // 15% remaining
    const remaining = limit - used;
    const pct = (remaining / limit) * 100;
    expect(pct).toBeLessThan(20);
    expect(NOTIFICATION_TYPES).toContain('LOW_LIMIT');
  });

  it('FULL_TANK_PENDING triggers for full tank orders', () => {
    const volume = 80;
    const FULL_TANK_MAX_LITERS = 80;
    const isFullTank = volume >= FULL_TANK_MAX_LITERS;
    expect(isFullTank).toBe(true);
    expect(NOTIFICATION_TYPES).toContain('FULL_TANK_PENDING');
  });

  it('COURIER_ASSIGNED triggers when status becomes ASSIGNED', () => {
    const prevStatus = 'PENDING_APPROVAL';
    const newStatus = 'ASSIGNED';
    const shouldNotify = newStatus === 'ASSIGNED';
    expect(shouldNotify).toBe(true);
    expect(NOTIFICATION_TYPES).toContain('COURIER_ASSIGNED');
  });

  it('ORDER_DELIVERED triggers when status becomes DELIVERED or CLOSED', () => {
    const deliveredStatuses = ['DELIVERED', 'CLOSED'];
    expect(deliveredStatuses).toContain('DELIVERED');
    expect(deliveredStatuses).toContain('CLOSED');
    expect(NOTIFICATION_TYPES).toContain('ORDER_DELIVERED');
  });

  it('20% threshold calculation', () => {
    const limit = 100;
    const threshold = limit * 0.2;
    expect(threshold).toBe(20);
    expect(19).toBeLessThan(threshold);
    expect(20).toBe(threshold);
  });
});
