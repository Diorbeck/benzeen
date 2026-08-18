import { describe, it, expect } from 'vitest';
import {
  aggregateStocks,
  distanceKm,
  hashControllerKey,
  isReadingFresh,
  isStationOnline,
  verifyControllerKey,
  type TankLike,
} from './stations';

const NOW = new Date('2026-08-18T20:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const tank = (over: Partial<TankLike> = {}): TankLike => ({
  fuelType: 'AI_95',
  status: 'ACTIVE',
  capacityL: 20_000,
  currentLevelL: 8_000,
  lastReadingAt: minutesAgo(1),
  ...over,
});

describe('isStationOnline', () => {
  it('свежий признак жизни — онлайн', () => {
    expect(isStationOnline(minutesAgo(1), NOW)).toBe(true);
    expect(isStationOnline(minutesAgo(4), NOW)).toBe(true);
  });
  it('тишина дольше пяти минут — офлайн', () => {
    expect(isStationOnline(minutesAgo(6), NOW)).toBe(false);
    expect(isStationOnline(minutesAgo(600), NOW)).toBe(false);
  });
  it('контроллер ни разу не выходил на связь — офлайн', () => {
    expect(isStationOnline(null, NOW)).toBe(false);
    expect(isStationOnline(undefined, NOW)).toBe(false);
  });
});

describe('isReadingFresh', () => {
  it('показание в пределах 15 минут — свежее', () => {
    expect(isReadingFresh(minutesAgo(14), NOW)).toBe(true);
  });
  it('старше 15 минут — устаревшее', () => {
    expect(isReadingFresh(minutesAgo(16), NOW)).toBe(false);
    expect(isReadingFresh(null, NOW)).toBe(false);
  });
});

describe('aggregateStocks', () => {
  it('складывает резервуары одного вида топлива', () => {
    const stocks = aggregateStocks(
      [tank({ currentLevelL: 8_000 }), tank({ currentLevelL: 3_500, capacityL: 10_000 })],
      NOW,
    );
    expect(stocks).toHaveLength(1);
    expect(stocks[0].litersAvailable).toBe(11_500);
    expect(stocks[0].capacityL).toBe(30_000);
    expect(stocks[0].tanksCount).toBe(2);
    expect(stocks[0].dataFresh).toBe(true);
  });

  it('резервуар на обслуживании не попадает в остаток вообще', () => {
    const stocks = aggregateStocks(
      [tank({ currentLevelL: 8_000 }), tank({ status: 'MAINTENANCE', currentLevelL: 9_000 })],
      NOW,
    );
    expect(stocks[0].litersAvailable).toBe(8_000);
    expect(stocks[0].tanksCount).toBe(1);
  });

  it('один устаревший резервуар помечает весь вид топлива несвежим', () => {
    const stocks = aggregateStocks(
      [tank({ currentLevelL: 8_000 }), tank({ lastReadingAt: minutesAgo(90), currentLevelL: 5_000 })],
      NOW,
    );
    expect(stocks[0].dataFresh).toBe(false);
    // Устаревший резервуар не добавляет литры: показывать сумму, в которой
    // часть данных вымышлена, нельзя.
    expect(stocks[0].litersAvailable).toBe(8_000);
  });

  it('отрицательный уровень с датчика не уводит остаток ниже нуля', () => {
    const stocks = aggregateStocks([tank({ currentLevelL: -50 })], NOW);
    expect(stocks[0].litersAvailable).toBe(0);
  });

  it('порядок видов топлива стабилен: 92, 95, 98, 100, дизель', () => {
    const stocks = aggregateStocks(
      [
        tank({ fuelType: 'DIESEL' }),
        tank({ fuelType: 'AI_98' }),
        tank({ fuelType: 'AI_92' }),
        tank({ fuelType: 'AI_95' }),
      ],
      NOW,
    );
    expect(stocks.map((s) => s.fuelType)).toEqual(['AI_92', 'AI_95', 'AI_98', 'DIESEL']);
  });

  it('пустой список резервуаров — пустые остатки, а не ноль литров', () => {
    expect(aggregateStocks([], NOW)).toEqual([]);
  });
});

describe('distanceKm', () => {
  it('ноль для одной и той же точки', () => {
    expect(distanceKm({ lat: 41.31, lng: 69.24 }, { lat: 41.31, lng: 69.24 })).toBe(0);
  });
  it('Ташкент — Самарканд примерно 270 км', () => {
    const d = distanceKm({ lat: 41.2995, lng: 69.2401 }, { lat: 39.627, lng: 66.975 });
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(290);
  });
});

describe('ключ контроллера АЗС', () => {
  it('верный ключ проходит', () => {
    const key = 'bz_station_test_key_0123456789';
    expect(verifyControllerKey(key, hashControllerKey(key))).toBe(true);
  });
  it('неверный ключ не проходит', () => {
    expect(verifyControllerKey('другой-ключ', hashControllerKey('ключ'))).toBe(false);
  });
  it('АЗС без заданного ключа не принимает телеметрию', () => {
    expect(verifyControllerKey('любой', null)).toBe(false);
    expect(verifyControllerKey('любой', '')).toBe(false);
  });
  it('мусор вместо хеша не роняет проверку', () => {
    expect(verifyControllerKey('любой', 'не-hex')).toBe(false);
  });
});
