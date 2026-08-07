// Курьер 2.0: when a B2C order is geo-dispatched and NO courier is on-duty with
// a fresh location, the order must stay alive (RECEIVED, still assignable) and a
// Sentry "no couriers on duty" warning must be emitted. We mock prisma + Sentry
// and assert the emit fires and no order write/unassign happens.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  courierLocationFindMany: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: h.captureMessage,
  captureException: vi.fn(),
}));

vi.mock('./prisma', () => ({
  prisma: {
    order: { findUnique: h.orderFindUnique, update: h.orderUpdate },
    courierLocation: { findMany: h.courierLocationFindMany },
    user: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('./telegram', () => ({
  sendTelegramMessage: h.sendTelegramMessage,
  getMiniAppUrl: () => null,
  FUEL_LABEL_RU: {},
  escapeHtml: (s: string) => s,
}));

vi.mock('./notifications', () => ({ createNotification: vi.fn() }));

import { dispatchB2COrderToNearest } from './order-dispatch';

describe('dispatchB2COrderToNearest with no on-duty couriers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.orderFindUnique.mockResolvedValue({ lat: 41.31, lng: 69.24 });
    // No on-duty courier has a fresh location.
    h.courierLocationFindMany.mockResolvedValue([]);
  });

  it('emits the Sentry warning and does not offer/mutate the order', async () => {
    const offered = await dispatchB2COrderToNearest('order-1');

    expect(offered).toBe(0);
    // Order left untouched (not unassigned/failed) — redispatch picks it up later.
    expect(h.orderUpdate).not.toHaveBeenCalled();
    // No courier was messaged.
    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
    // Sentry "no couriers on duty" warning fired with orderId context.
    expect(h.captureMessage).toHaveBeenCalledTimes(1);
    const [msg, opts] = h.captureMessage.mock.calls[0];
    expect(msg).toBe('no couriers on duty');
    expect(opts.level).toBe('warning');
    expect(opts.extra.orderId).toBe('order-1');
    expect(opts.tags.orderType).toBe('b2c');
  });

  it('offers to an eligible courier and does NOT emit the warning', async () => {
    h.courierLocationFindMany.mockResolvedValue([
      { lat: 41.32, lng: 69.25, courier: { telegramId: '555' } },
    ]);

    const offered = await dispatchB2COrderToNearest('order-2');

    expect(offered).toBe(1);
    expect(h.captureMessage).not.toHaveBeenCalled();
    expect(h.sendTelegramMessage).toHaveBeenCalled();
  });
});
