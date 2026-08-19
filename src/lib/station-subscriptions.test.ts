import { describe, expect, it } from 'vitest';
import {
  activeSubscription,
  buildSubscriptionStates,
  dailyChargeUzs,
  defaultDailyRate,
  validateDailyRate,
  type SubscriptionRow,
  type SubscriptionTarget,
} from './station-subscriptions';

const tank: SubscriptionTarget = { id: 'tank-1', item: 'TANK', label: 'Р-1' };
const dispenser: SubscriptionTarget = { id: 'disp-1', item: 'DISPENSER', label: '1' };

function row(partial: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: 'row-1',
    item: 'TANK',
    tankId: 'tank-1',
    dispenserId: null,
    dailyRateUzs: 25_000,
    startedAt: new Date('2026-08-01T00:00:00Z'),
    endedAt: null,
    ...partial,
  };
}

describe('ставки подписки', () => {
  it('резервуар тарифицируется по 25 000 сум в сутки', () => {
    expect(defaultDailyRate('TANK')).toBe(25_000);
  });

  it('колонка тарифицируется по 10 000 сум в сутки', () => {
    expect(defaultDailyRate('DISPENSER')).toBe(10_000);
  });
});

describe('активная строка подписки', () => {
  const now = new Date('2026-08-19T10:00:00Z');

  it('открытая строка считается активной', () => {
    expect(activeSubscription([row({})], tank, now)?.id).toBe('row-1');
  });

  it('закрытая строка не активна', () => {
    const closed = row({ endedAt: new Date('2026-08-10T00:00:00Z') });
    expect(activeSubscription([closed], tank, now)).toBeNull();
  });

  it('строка, начинающаяся в будущем, ещё не активна', () => {
    const future = row({ startedAt: new Date('2026-09-01T00:00:00Z') });
    expect(activeSubscription([future], tank, now)).toBeNull();
  });

  it('после переподключения берётся последняя открытая строка', () => {
    const first = row({ id: 'old', endedAt: new Date('2026-08-05T00:00:00Z') });
    const second = row({ id: 'new', startedAt: new Date('2026-08-06T00:00:00Z') });
    expect(activeSubscription([first, second], tank, now)?.id).toBe('new');
  });

  it('строка по другому объекту не подхватывается', () => {
    const other = row({ tankId: 'tank-2' });
    expect(activeSubscription([other], tank, now)).toBeNull();
  });

  it('строка по колонке ищется по dispenserId', () => {
    const disp = row({ id: 'd', item: 'DISPENSER', tankId: null, dispenserId: 'disp-1', dailyRateUzs: 10_000 });
    expect(activeSubscription([disp], dispenser, now)?.id).toBe('d');
  });
});

describe('состояние подписки по объектам', () => {
  const now = new Date('2026-08-19T10:00:00Z');

  it('неподключённый объект показывает ставку по умолчанию', () => {
    const states = buildSubscriptionStates([tank, dispenser], [], now);
    expect(states.map((s) => [s.active, s.dailyRateUzs])).toEqual([
      [null, 25_000],
      [null, 10_000],
    ]);
  });

  it('подключённый объект показывает ставку из своей строки', () => {
    const custom = row({ dailyRateUzs: 20_000 });
    const [state] = buildSubscriptionStates([tank], [custom], now);
    expect(state.dailyRateUzs).toBe(20_000);
    expect(state.active?.id).toBe('row-1');
  });

  it('суточная стоимость складывается только по активным строкам', () => {
    const disp = row({ id: 'd', item: 'DISPENSER', tankId: null, dispenserId: 'disp-1', dailyRateUzs: 10_000 });
    const states = buildSubscriptionStates([tank, dispenser], [disp], now);
    expect(dailyChargeUzs(states)).toBe(10_000);
  });
});

describe('проверка ставки', () => {
  it('целое положительное значение принимается', () => {
    expect(validateDailyRate(30_000)).toEqual({ ok: true, dailyRateUzs: 30_000 });
  });

  it('строка с числом принимается', () => {
    expect(validateDailyRate('12000')).toEqual({ ok: true, dailyRateUzs: 12_000 });
  });

  it('нулевая и отрицательная ставка отклоняются', () => {
    expect(validateDailyRate(0).ok).toBe(false);
    expect(validateDailyRate(-5).ok).toBe(false);
  });

  it('дробная ставка отклоняется', () => {
    expect(validateDailyRate(1000.5).ok).toBe(false);
  });

  it('нечисловое значение отклоняется', () => {
    expect(validateDailyRate('дорого').ok).toBe(false);
    expect(validateDailyRate(null).ok).toBe(false);
  });

  it('неправдоподобно большая ставка отклоняется', () => {
    expect(validateDailyRate(50_000_000).ok).toBe(false);
  });
});
