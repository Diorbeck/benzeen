import { describe, it, expect } from 'vitest';
import {
  billableDays,
  buildInvoiceDraft,
  defaultDailyRate,
  monthEnd,
  monthStart,
  type SubscriptionPeriod,
} from './station-billing';

const JULY_START = new Date('2026-07-01T00:00:00.000Z');
const JULY_END = new Date('2026-08-01T00:00:00.000Z');

const sub = (over: Partial<SubscriptionPeriod> = {}): SubscriptionPeriod => ({
  item: 'TANK',
  dailyRateUzs: 25_000,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  endedAt: null,
  ...over,
});

describe('границы месяца', () => {
  it('начало и конец расчётного периода', () => {
    expect(monthStart(new Date('2026-07-17T13:45:00.000Z')).toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );
    expect(monthEnd(new Date('2026-07-17T13:45:00.000Z')).toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });
  it('декабрь перекатывается в январь следующего года', () => {
    expect(monthEnd(new Date('2026-12-05T00:00:00.000Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });
});

describe('billableDays', () => {
  it('подписка на весь месяц — все сутки месяца', () => {
    expect(billableDays(sub(), JULY_START, JULY_END)).toBe(31);
  });

  it('подключение в середине месяца — только с этого дня', () => {
    expect(
      billableDays(sub({ startedAt: new Date('2026-07-21T00:00:00.000Z') }), JULY_START, JULY_END),
    ).toBe(11);
  });

  it('начатые сутки считаются целиком', () => {
    // Подключились 31 июля в 23:50 — это одни сутки, а не 10 минут.
    expect(
      billableDays(sub({ startedAt: new Date('2026-07-31T23:50:00.000Z') }), JULY_START, JULY_END),
    ).toBe(1);
  });

  it('отключение в середине месяца обрезает период', () => {
    expect(
      billableDays(
        sub({ endedAt: new Date('2026-07-11T00:00:00.000Z') }),
        JULY_START,
        JULY_END,
      ),
    ).toBe(10);
  });

  it('подписка целиком вне периода не тарифицируется', () => {
    expect(
      billableDays(
        sub({
          startedAt: new Date('2026-05-01T00:00:00.000Z'),
          endedAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
        JULY_START,
        JULY_END,
      ),
    ).toBe(0);
    expect(
      billableDays(sub({ startedAt: new Date('2026-09-01T00:00:00.000Z') }), JULY_START, JULY_END),
    ).toBe(0);
  });

  it('отключение раньше подключения не даёт отрицательных суток', () => {
    expect(
      billableDays(
        sub({
          startedAt: new Date('2026-07-20T00:00:00.000Z'),
          endedAt: new Date('2026-07-10T00:00:00.000Z'),
        }),
        JULY_START,
        JULY_END,
      ),
    ).toBe(0);
  });
});

describe('buildInvoiceDraft', () => {
  it('два резервуара и одна колонка за полный июль', () => {
    const draft = buildInvoiceDraft(
      [sub(), sub(), sub({ item: 'DISPENSER', dailyRateUzs: 10_000 })],
      JULY_START,
      JULY_END,
    );
    expect(draft.tankDays).toBe(62);
    expect(draft.dispenserDays).toBe(31);
    // 62 × 25 000 + 31 × 10 000
    expect(draft.amountUzs).toBe(62 * 25_000 + 31 * 10_000);
  });

  it('счёт по ставке из строки подписки, а не по текущему тарифу', () => {
    const draft = buildInvoiceDraft(
      [sub({ dailyRateUzs: 20_000 })],
      JULY_START,
      JULY_END,
    );
    expect(draft.amountUzs).toBe(31 * 20_000);
  });

  it('АЗС без подписок — нулевой счёт, а не ошибка', () => {
    const draft = buildInvoiceDraft([], JULY_START, JULY_END);
    expect(draft).toMatchObject({ tankDays: 0, dispenserDays: 0, amountUzs: 0 });
  });

  it('ставки по умолчанию совпадают с бизнес-моделью', () => {
    expect(defaultDailyRate('TANK')).toBe(25_000);
    expect(defaultDailyRate('DISPENSER')).toBe(10_000);
  });
});
