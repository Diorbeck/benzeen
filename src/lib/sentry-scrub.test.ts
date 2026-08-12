import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubEvent } from './sentry-scrub';

const hint = {} as never;

describe('scrubEvent (PR-A: маскировка PII)', () => {
  it('маскирует телефоны и почты в breadcrumbs (message и data)', () => {
    const event = {
      breadcrumbs: [
        {
          message: 'Клиент +998 90 123 45 67 не дозвонился',
          data: { phone: '+998901234567', note: 'почта user@mail.com', count: 3 },
        },
      ],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event, hint);
    expect(out.breadcrumbs?.[0].message).not.toContain('998');
    expect(out.breadcrumbs?.[0].message).toContain('[phone]');
    expect(out.breadcrumbs?.[0].data?.phone).toBe('[phone]');
    expect(out.breadcrumbs?.[0].data?.note).toBe('почта [email]');
    expect(out.breadcrumbs?.[0].data?.count).toBe(3);
  });

  it('маскирует строки в extra и удаляет user', () => {
    const event = {
      user: { id: 'u1' },
      extra: { debug: 'звонили на +998971112233', n: 7 },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event, hint);
    expect(out.user).toBeUndefined();
    expect(out.extra?.debug).toBe('звонили на [phone]');
    expect(out.extra?.n).toBe(7);
  });

  it('маскирует телефон в тексте исключения', () => {
    const event = {
      exception: { values: [{ value: 'User +998901234567 failed login' }] },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event, hint);
    expect(out.exception?.values?.[0].value).toBe('User [phone] failed login');
  });
});
