import { describe, it, expect } from 'vitest';
import { calcOrderPrice } from './pricing';
import { formatMoney, formatLiters, litersUnit } from './format';
import {
  resolveLiters,
  submitBlockReason,
  canSubmitOrder,
  type OrderFormState,
} from './order-form';
import { loadDraft, saveDraft, clearDraft, isMeaningfulDraft, type StorageLike } from './order-draft';

describe('calcOrderPrice', () => {
  it('multiplies liters × price (68 × 15800, computed not hardcoded)', () => {
    const r = calcOrderPrice({ pricePerLiter: 15800, volume: 68 });
    expect(r.total).toBe(15800 * 68);
    expect(r.liters).toBe(68);
    expect(r.pricePerLiter).toBe(15800);
  });
  it('floors partial liters and never goes negative', () => {
    expect(calcOrderPrice({ pricePerLiter: 13800, volume: 30.9 }).total).toBe(13800 * 30);
    expect(calcOrderPrice({ pricePerLiter: -5, volume: -5 }).total).toBe(0);
  });
  it('handles NaN input safely', () => {
    expect(calcOrderPrice({ pricePerLiter: NaN, volume: 40 }).total).toBe(0);
  });
});

describe('formatMoney / liters', () => {
  it('groups UZS by locale', () => {
    // ru/uz use non-breaking-space grouping; en uses commas.
    expect(formatMoney(1074400, 'en')).toBe('1,074,400');
    expect(formatMoney(1074400, 'ru').replace(/\s/g, ' ')).toMatch(/1.074.400/);
  });
  it('pluralizes liters by locale', () => {
    expect(litersUnit(1, 'ru')).toBe('литр');
    expect(litersUnit(2, 'ru')).toBe('литра');
    expect(litersUnit(30, 'ru')).toBe('литров');
    expect(litersUnit(30, 'uz')).toBe('litr');
    expect(litersUnit(1, 'en')).toBe('liter');
    expect(litersUnit(30, 'en')).toBe('liters');
    expect(formatLiters(40, 'ru')).toBe('40 литров');
  });
});

const base: OrderFormState = {
  point: { lat: 41.31, lng: 69.28 },
  hasExistingCar: false,
  newPlate: '01 A 123 BC',
  fuelType: 'AI_92',
  volume: 30,
  isFullTank: false,
  knownTankCapacity: 50,
};

describe('order-form validity (fuel/volume + enabled/disabled)', () => {
  it('a complete order can be submitted', () => {
    expect(canSubmitOrder(base)).toBe(true);
    expect(submitBlockReason(base)).toBeNull();
  });
  it('any fuel type keeps a valid order valid', () => {
    for (const fuelType of ['AI_92', 'AI_95', 'AI_100'] as const) {
      expect(canSubmitOrder({ ...base, fuelType })).toBe(true);
    }
  });
  it('blocks with a reason when a required field is missing', () => {
    expect(submitBlockReason({ ...base, point: null })).toBe('no_point');
    expect(submitBlockReason({ ...base, newPlate: '  ' })).toBe('no_car');
    expect(submitBlockReason({ ...base, volume: 20 })).toBe('min_volume');
    expect(submitBlockReason({ ...base, isFullTank: true, knownTankCapacity: null })).toBe('no_tank_capacity');
  });
  it('an existing car needs no new plate', () => {
    expect(canSubmitOrder({ ...base, hasExistingCar: true, newPlate: '' })).toBe(true);
  });
  it('volume presets 30/40/50/60 all pass the minimum', () => {
    for (const v of [30, 40, 50, 60]) expect(canSubmitOrder({ ...base, volume: v })).toBe(true);
  });
  it('resolveLiters uses tank capacity for full tank', () => {
    expect(resolveLiters({ isFullTank: true, volume: 30, knownTankCapacity: 55 })).toBe(55);
    expect(resolveLiters({ isFullTank: false, volume: 40, knownTankCapacity: 55 })).toBe(40);
  });
});

describe('order draft persistence', () => {
  function fakeStorage(): StorageLike {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
    };
  }
  it('saves and restores a meaningful draft', () => {
    const s = fakeStorage();
    saveDraft({ fuelType: 'AI_95', volume: 40, address: 'по ориентиру' }, 1000, s);
    const back = loadDraft(s);
    expect(back?.fuelType).toBe('AI_95');
    expect(back?.volume).toBe(40);
    expect(back?.updatedAt).toBe(1000);
  });
  it('ignores an empty draft and clears', () => {
    const s = fakeStorage();
    saveDraft({}, 1, s);
    expect(loadDraft(s)).toBeNull();
    saveDraft({ volume: 50 }, 2, s);
    clearDraft(s);
    expect(loadDraft(s)).toBeNull();
  });
  it('isMeaningfulDraft flags real vs empty', () => {
    expect(isMeaningfulDraft({ fuelType: 'AI_92' })).toBe(true);
    expect(isMeaningfulDraft({})).toBe(false);
    expect(isMeaningfulDraft(null)).toBe(false);
  });
});
