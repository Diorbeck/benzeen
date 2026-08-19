import { describe, it, expect } from 'vitest';
import {
  applyTick,
  decideStale,
  FULL_TANK_LITERS_CAP,
  FuelingError,
  MIN_HOLD_UZS,
  planHold,
  settle,
  type StaleSession,
} from './fueling';

const PRICE = 10_000; // сум за литр

describe('расчёт резерва', () => {
  it('литры: резерв по цене старта', () => {
    const plan = planHold({ liters: 20 }, PRICE, 5_000);
    expect(plan).toEqual({ holdAmountUzs: 200_000, limitLiters: 20, mode: 'LITERS' });
  });

  it('сумма: лимит отпуска считается из суммы', () => {
    const plan = planHold({ amountUzs: 150_000 }, PRICE, 5_000);
    expect(plan.holdAmountUzs).toBe(150_000);
    expect(plan.limitLiters).toBeCloseTo(15);
    expect(plan.mode).toBe('AMOUNT');
  });

  it('полный бак: холдируется потолок', () => {
    const plan = planHold({ fullTank: true }, PRICE, 5_000);
    expect(plan.mode).toBe('FULL_TANK');
    expect(plan.limitLiters).toBe(FULL_TANK_LITERS_CAP);
    expect(plan.holdAmountUzs).toBe(FULL_TANK_LITERS_CAP * PRICE);
  });

  it('полный бак ограничен остатком в резервуаре', () => {
    const plan = planHold({ fullTank: true }, PRICE, 12);
    expect(plan.limitLiters).toBe(12);
    expect(plan.holdAmountUzs).toBe(120_000);
  });

  it('нет цены — отказ, а не резерв на ноль', () => {
    expect(() => planHold({ liters: 10 }, 0, 100)).toThrow(FuelingError);
  });

  it('литры и сумма одновременно — отказ', () => {
    expect(() => planHold({ liters: 10, amountUzs: 100_000 }, PRICE, 100)).toThrow(/либо литры/);
  });

  it('запрошено больше, чем есть в резервуарах', () => {
    expect(() => planHold({ liters: 60 }, PRICE, 50)).toThrow(/меньше топлива/);
    expect(() => planHold({ amountUzs: 600_000 }, PRICE, 50)).toThrow(/меньше топлива/);
  });

  it('сумма ниже минимальной для холда', () => {
    expect(() => planHold({ amountUzs: 2_000 }, PRICE, 100)).toThrow(/Минимальная сумма/);
  });

  it('маленький объём поднимается до минимального холда', () => {
    const plan = planHold({ liters: 0.5 }, PRICE, 100);
    expect(plan.holdAmountUzs).toBe(MIN_HOLD_UZS);
    expect(plan.limitLiters).toBe(0.5);
  });

  it('нет топлива вовсе — полный бак невозможен', () => {
    expect(() => planHold({ fullTank: true }, PRICE, 0)).toThrow(/нет этого топлива/);
  });
});

describe('живые данные с колонки', () => {
  it('сумма считается по нашей цене, а не по присланной колонкой', () => {
    const state = applyTick({ liters: 12.34, amountUzs: 999 }, PRICE, 20);
    expect(state.liters).toBeCloseTo(12.34);
    expect(state.amountUzs).toBe(123_400);
    expect(state.limitReached).toBe(false);
  });

  it('литры обрезаются лимитом отпуска', () => {
    const state = applyTick({ liters: 25 }, PRICE, 20);
    expect(state.liters).toBe(20);
    expect(state.amountUzs).toBe(200_000);
    expect(state.limitReached).toBe(true);
  });

  it('мусор вместо литров не ломает экран клиента', () => {
    const state = applyTick({ liters: Number.NaN }, PRICE, 20);
    expect(state.liters).toBe(0);
    expect(state.amountUzs).toBe(0);
  });
});

describe('закрытие транзакции', () => {
  it('списывается факт, разница возвращается', () => {
    const s = settle(43.21, PRICE, FULL_TANK_LITERS_CAP * PRICE);
    expect(s.captureUzs).toBe(432_100);
    expect(s.refundUzs).toBe(800_000 - 432_100);
    expect(s.cashbackUzs).toBe(4_321);
  });

  it('залито ровно на резерв — возвращать нечего', () => {
    const s = settle(20, PRICE, 200_000);
    expect(s.captureUzs).toBe(200_000);
    expect(s.refundUzs).toBe(0);
  });

  it('перелив сверх резерва не списывается с клиента', () => {
    const s = settle(25, PRICE, 200_000);
    expect(s.captureUzs).toBe(200_000);
    expect(s.refundUzs).toBe(0);
  });

  it('заливки не было — резерв возвращается целиком', () => {
    const s = settle(0, PRICE, 200_000);
    expect(s.captureUzs).toBe(0);
    expect(s.refundUzs).toBe(200_000);
    expect(s.cashbackUzs).toBe(0);
  });
});

describe('зависшие сессии', () => {
  const now = new Date('2026-08-19T10:00:00.000Z');
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000);
  const session = (over: Partial<StaleSession> = {}): StaleSession => ({
    status: 'RESERVED',
    startedAt: at(1),
    lastTickAt: null,
    litersDispensed: null,
    ...over,
  });

  it('свежий резерв не трогаем', () => {
    expect(decideStale(session(), now)).toEqual({ action: 'KEEP' });
  });

  it('пистолет так и не вставили — резерв размораживается', () => {
    expect(decideStale(session({ startedAt: at(31) }), now)).toEqual({
      action: 'CANCEL',
      reason: 'NEVER_STARTED',
    });
  });

  it('колонка замолчала после заливки — закрываем по последним литрам', () => {
    const d = decideStale(
      session({ status: 'FLOWING', startedAt: at(5), lastTickAt: at(2), litersDispensed: 18 }),
      now,
    );
    expect(d).toEqual({ action: 'COMPLETE', reason: 'FLOW_IDLE' });
  });

  it('заливка идёт, тики свежие — ждём', () => {
    const d = decideStale(
      session({
        status: 'FLOWING',
        startedAt: at(2),
        lastTickAt: new Date(now.getTime() - 3_000),
        litersDispensed: 7,
      }),
      now,
    );
    expect(d).toEqual({ action: 'KEEP' });
  });

  it('связь пропала надолго — ручная сверка по логу колонки', () => {
    const d = decideStale(
      session({ status: 'FLOWING', startedAt: at(45), lastTickAt: at(35), litersDispensed: 9 }),
      now,
    );
    expect(d).toEqual({ action: 'MANUAL_REVIEW', reason: 'CONNECTION_LOST' });
  });
});
