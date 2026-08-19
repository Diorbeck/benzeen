import { describe, expect, it } from 'vitest';
import {
  DEMO_MAX_FILL,
  DEMO_MIN_FILL,
  demoFillRatio,
  simulateDemoTanks,
  type DemoTank,
} from './station-demo';
import { aggregateStocks } from './stations';

const tank = (over: Partial<DemoTank> = {}): DemoTank => ({
  id: 'tk_1',
  fuelType: 'AI_92',
  status: 'ACTIVE',
  capacityL: 30_000,
  currentLevelL: null,
  lastReadingAt: null,
  ...over,
});

describe('демо-датчики АЗС', () => {
  it('держит уровень в разумных границах в любой момент времени', () => {
    for (let h = 0; h < 48; h += 1) {
      const now = new Date(Date.UTC(2026, 7, 19, h, 17));
      const ratio = demoFillRatio('tk_1:AI_92', now);
      expect(ratio).toBeGreaterThanOrEqual(DEMO_MIN_FILL - 0.02);
      expect(ratio).toBeLessThanOrEqual(DEMO_MAX_FILL + 0.02);
    }
  });

  it('на один и тот же момент даёт одно и то же значение', () => {
    const now = new Date('2026-08-19T10:00:00Z');
    expect(demoFillRatio('tk_1:AI_92', now)).toBe(demoFillRatio('tk_1:AI_92', now));
  });

  it('разные резервуары пустеют не синхронно', () => {
    const now = new Date('2026-08-19T10:00:00Z');
    const a = demoFillRatio('tk_1:AI_92', now);
    const b = demoFillRatio('tk_2:AI_95', now);
    expect(a).not.toBe(b);
  });

  it('со временем цифра меняется — она не застывает', () => {
    const t1 = demoFillRatio('tk_1:AI_92', new Date('2026-08-19T10:00:00Z'));
    const t2 = demoFillRatio('tk_1:AI_92', new Date('2026-08-19T12:00:00Z'));
    expect(t1).not.toBe(t2);
  });

  it('подставляет свежее показание, поэтому остаток считается живым', () => {
    const now = new Date('2026-08-19T10:00:00Z');
    const [simulated] = simulateDemoTanks([tank()], now);
    expect(simulated.lastReadingAt).toEqual(now);
    expect(simulated.currentLevelL).toBeGreaterThan(0);

    const [stock] = aggregateStocks([simulated], now);
    expect(stock.dataFresh).toBe(true);
    expect(stock.litersAvailable).toBe(simulated.currentLevelL);
  });

  it('резервуар на обслуживании остаётся без данных', () => {
    const now = new Date('2026-08-19T10:00:00Z');
    const [simulated] = simulateDemoTanks([tank({ status: 'MAINTENANCE' })], now);
    expect(simulated.currentLevelL).toBeNull();
    expect(simulated.lastReadingAt).toBeNull();
  });

  it('не выходит за ёмкость резервуара', () => {
    const now = new Date('2026-08-19T10:00:00Z');
    const [simulated] = simulateDemoTanks([tank({ capacityL: 1_000 })], now);
    expect(simulated.currentLevelL as number).toBeLessThanOrEqual(1_000);
  });
});
