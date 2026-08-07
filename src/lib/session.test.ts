import { describe, it, expect } from 'vitest';
import { pickDefaultCarId } from './session';
import {
  sessionMaxAgeSeconds,
  CLIENT_SESSION_MAX_AGE,
  STAFF_SESSION_MAX_AGE,
} from './session-policy';

describe('sessionMaxAgeSeconds (per-role session lifetime)', () => {
  it('gives CLIENT the 180-day session', () => {
    expect(sessionMaxAgeSeconds('CLIENT')).toBe(CLIENT_SESSION_MAX_AGE);
    expect(CLIENT_SESSION_MAX_AGE).toBe(180 * 24 * 60 * 60);
  });
  it('keeps staff at the 30-day default', () => {
    for (const role of ['SUPER_ADMIN', 'DRIVER', 'COURIER', 'MANAGER']) {
      expect(sessionMaxAgeSeconds(role)).toBe(STAFF_SESSION_MAX_AGE);
    }
    expect(STAFF_SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });
  it('defaults unknown/absent role to the shorter staff lifetime', () => {
    expect(sessionMaxAgeSeconds(undefined)).toBe(STAFF_SESSION_MAX_AGE);
    expect(sessionMaxAgeSeconds(null)).toBe(STAFF_SESSION_MAX_AGE);
    expect(sessionMaxAgeSeconds('')).toBe(STAFF_SESSION_MAX_AGE);
  });
});

describe('pickDefaultCarId (fallback chain + ownership guard)', () => {
  const carIds = ['a', 'b', 'c'];

  it('prefers the explicit default when still owned', () => {
    expect(
      pickDefaultCarId({ explicitDefaultId: 'b', carIds, lastUsedCarId: 'a', mostRecentCarId: 'c' }),
    ).toBe('b');
  });

  it('falls back to the most-recently-used car when no explicit default', () => {
    expect(
      pickDefaultCarId({ explicitDefaultId: null, carIds, lastUsedCarId: 'a', mostRecentCarId: 'c' }),
    ).toBe('a');
  });

  it('falls back to the most-recently-created car when nothing used yet', () => {
    expect(
      pickDefaultCarId({ explicitDefaultId: null, carIds, lastUsedCarId: null, mostRecentCarId: 'c' }),
    ).toBe('c');
  });

  it('ignores a stale pointer to a car the user no longer owns', () => {
    expect(
      pickDefaultCarId({ explicitDefaultId: 'gone', carIds, lastUsedCarId: 'zzz', mostRecentCarId: 'b' }),
    ).toBe('b');
  });

  it('returns null when the client has no cars', () => {
    expect(
      pickDefaultCarId({ explicitDefaultId: null, carIds: [], lastUsedCarId: null, mostRecentCarId: null }),
    ).toBe(null);
  });
});
