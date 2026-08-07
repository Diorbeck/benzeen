import { describe, it, expect } from 'vitest';
import { orderSummary, formatDeliveryTime } from './order-dispatch';
import { courierOrderActions } from './courier-actions';
import { escapeHtml } from './telegram';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });
});

describe('orderSummary card', () => {
  it('bolds fuel and liters', () => {
    const s = orderSummary({
      fuelType: 'AI_95',
      volume: 30,
      isFullTank: false,
      car: { plateNumber: '01A123BC' },
    });
    expect(s).toContain('Топливо: <b>АИ-95</b>');
    expect(s).toContain('Объём: <b>30 л</b>');
  });

  it('renders the address as a map link when coordinates are present', () => {
    const s = orderSummary({
      fuelType: 'AI_92',
      volume: 20,
      isFullTank: false,
      address: 'ул. Навои 10',
      lat: 41.31,
      lng: 69.24,
      clientCar: { plate: '30X000XX' },
    });
    expect(s).toContain('<a href="https://yandex.ru/maps/?pt=69.24,41.31&z=17&l=map">ул. Навои 10</a>');
  });

  it('renders the client phone as a tel: link', () => {
    const s = orderSummary({
      fuelType: 'AI_92',
      volume: 20,
      isFullTank: false,
      clientPhone: '+998 90 123 45 67',
    });
    expect(s).toContain('<a href="tel:+998901234567">+998 90 123 45 67</a>');
  });

  it('shows the scheduled delivery time prominently at the top', () => {
    const s = orderSummary({
      fuelType: 'AI_92',
      volume: 20,
      isFullTank: false,
      scheduledFor: new Date('2026-08-07T09:30:00Z'), // 14:30 Tashkent (UTC+5)
    });
    expect(s.startsWith('⏰ <b>К ')).toBe(true);
    expect(s).toContain('14:30');
  });

  it('escapes HTML in dynamic values', () => {
    const s = orderSummary({
      fuelType: 'AI_92',
      volume: 20,
      isFullTank: false,
      address: 'A & <B>',
      car: { plateNumber: '01<X>' },
    });
    expect(s).toContain('01&lt;X&gt;');
    expect(s).toContain('A &amp; &lt;B&gt;');
  });
});

describe('formatDeliveryTime', () => {
  it('formats in Tashkent local time', () => {
    expect(formatDeliveryTime(new Date('2026-08-07T09:30:00Z'))).toBe('07.08 в 14:30');
  });
});

describe('courierOrderActions', () => {
  it('offers the on-route action for an assigned order', () => {
    const kb = courierOrderActions({ id: 'o1', status: 'COURIER_ASSIGNED' });
    expect(kb?.inline_keyboard[0][0].callback_data).toBe('on_route:o1');
  });

  it('offers the delivered action for an in-delivery order', () => {
    const kb = courierOrderActions({ id: 'o1', status: 'IN_DELIVERY' });
    expect(kb?.inline_keyboard[0][0].text).toContain('Доставлено');
  });

  it('returns no actions for other statuses', () => {
    expect(courierOrderActions({ id: 'o1', status: 'RECEIVED' })).toBeUndefined();
  });
});
