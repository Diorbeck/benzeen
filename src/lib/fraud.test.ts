import { describe, it, expect } from 'vitest';
import {
  maxSharedWithin,
  maxSharedValue,
  evaluateReferrerFlags,
  isFastClose,
  type FirstOrderSignal,
} from './fraud';

const TASHKENT = { lat: 41.3111, lng: 69.2797 };
// ~60 m north of TASHKENT (0.00054° lat ≈ 60 m).
const NEAR = { lat: 41.3111 + 0.00054, lng: 69.2797 };
// ~2 km away.
const FAR = { lat: 41.33, lng: 69.28 };

function sig(over: Partial<FirstOrderSignal>): FirstOrderSignal {
  return { clientId: 'c', lat: null, lng: null, plate: null, courierId: null, closeMs: null, ...over };
}

describe('maxSharedWithin (address clustering)', () => {
  it('counts points within ~100 m as shared', () => {
    expect(maxSharedWithin([TASHKENT, NEAR, TASHKENT], 100)).toBe(3);
  });
  it('does not group points that are far apart', () => {
    expect(maxSharedWithin([TASHKENT, FAR], 100)).toBe(1);
  });
  it('ignores rows with missing coordinates', () => {
    expect(maxSharedWithin([{ lat: null, lng: null }], 100)).toBe(0);
  });
});

describe('maxSharedValue (shared plate / courier)', () => {
  it('returns the largest identical-value group', () => {
    expect(maxSharedValue(['01A', '01A', '01A', '02B'])).toBe(3);
  });
  it('ignores null values', () => {
    expect(maxSharedValue([null, null, 'x'])).toBe(1);
  });
});

describe('evaluateReferrerFlags', () => {
  it('flags when ≥3 friends share a delivery address', () => {
    const orders = [
      sig({ lat: TASHKENT.lat, lng: TASHKENT.lng }),
      sig({ lat: NEAR.lat, lng: NEAR.lng }),
      sig({ lat: TASHKENT.lat, lng: TASHKENT.lng }),
    ];
    const f = evaluateReferrerFlags(orders);
    expect(f.sharedAddress).toBe(true);
    expect(f.any).toBe(true);
  });
  it('flags a shared plate and a shared courier', () => {
    const plate = evaluateReferrerFlags([
      sig({ plate: 'X' }),
      sig({ plate: 'X' }),
      sig({ plate: 'X' }),
    ]);
    expect(plate.sharedPlate).toBe(true);

    const courier = evaluateReferrerFlags([
      sig({ courierId: 'k' }),
      sig({ courierId: 'k' }),
      sig({ courierId: 'k' }),
    ]);
    expect(courier.sharedCourier).toBe(true);
  });
  it('flags ≥3 anomalously fast courier closes', () => {
    const f = evaluateReferrerFlags([
      sig({ closeMs: 60_000 }),
      sig({ closeMs: 120_000 }),
      sig({ closeMs: 5 * 60_000 }),
    ]);
    expect(f.fastCourierCloses).toBe(true);
  });
  it('does not flag honest, unrelated orders', () => {
    const f = evaluateReferrerFlags([
      sig({ lat: TASHKENT.lat, lng: TASHKENT.lng, plate: 'A', courierId: 'k1', closeMs: 30 * 60_000 }),
      sig({ lat: FAR.lat, lng: FAR.lng, plate: 'B', courierId: 'k2', closeMs: 40 * 60_000 }),
    ]);
    expect(f.any).toBe(false);
  });
});

describe('isFastClose', () => {
  it('true under 10 min, false at/over 10 min or unknown', () => {
    expect(isFastClose(9 * 60_000)).toBe(true);
    expect(isFastClose(10 * 60_000)).toBe(false);
    expect(isFastClose(null)).toBe(false);
    expect(isFastClose(-1)).toBe(false);
  });
});
