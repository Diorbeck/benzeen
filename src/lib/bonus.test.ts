import { describe, it, expect } from 'vitest';
import {
  computeBonusUsed,
  computeTotal,
  bonusBalanceFrom,
  spendableBonus,
  postedFriendFirstOrderCount,
  accrualStatusForDay,
  FRIEND_FIRST_ORDER_DAILY_CAP,
} from './bonus';

describe('computeBonusUsed (caps)', () => {
  it('uses the full balance when it fits under volume-1', () => {
    expect(computeBonusUsed(5, 30)).toBe(5);
  });
  it('caps at volume-1 so at least 1 liter is always paid', () => {
    expect(computeBonusUsed(100, 30)).toBe(29);
    expect(computeBonusUsed(100, 1)).toBe(0);
  });
  it('never negative / handles zero + junk input', () => {
    expect(computeBonusUsed(0, 30)).toBe(0);
    expect(computeBonusUsed(-5, 30)).toBe(0);
    expect(computeBonusUsed(5, 0)).toBe(0);
    expect(computeBonusUsed(NaN, 30)).toBe(0);
    expect(computeBonusUsed(5, NaN)).toBe(0);
  });
});

describe('computeTotal', () => {
  it('subtracts bonus liters from the billed volume', () => {
    expect(computeTotal(30, 5, 15800)).toBe(25 * 15800);
    expect(computeTotal(30, 0, 13800)).toBe(30 * 13800);
  });
  it('never bills negative', () => {
    expect(computeTotal(30, 40, 15800)).toBe(0);
  });
});

describe('bonusBalanceFrom (ledger)', () => {
  it('adds accruals, subtracts SPENT', () => {
    expect(
      bonusBalanceFrom([
        { liters: 1, reason: 'FRIEND_FIRST_ORDER' },
        { liters: 10, reason: 'TEN_FRIENDS_MILESTONE' },
        { liters: 4, reason: 'SPENT' },
      ]),
    ).toBe(7);
  });
  it('a REFUND row returns spent liters (SPENT + REFUND nets to zero)', () => {
    expect(
      bonusBalanceFrom([
        { liters: 5, reason: 'SPENT' },
        { liters: 5, reason: 'REFUND' },
      ]),
    ).toBe(0);
    expect(
      bonusBalanceFrom([
        { liters: 3, reason: 'FRIEND_FIRST_ORDER' },
        { liters: 3, reason: 'SPENT' },
        { liters: 3, reason: 'REFUND' },
      ]),
    ).toBe(3);
  });
  it('never negative', () => {
    expect(bonusBalanceFrom([{ liters: 5, reason: 'SPENT' }])).toBe(0);
  });
});

// ── PR-C money invariants ─────────────────────────────────────────────────────

describe('INVARIANT: balance counts ONLY POSTED rows', () => {
  it('excludes PENDING and REJECTED accruals from the balance', () => {
    const rows = [
      { liters: 5, reason: 'FRIEND_FIRST_ORDER', status: 'POSTED' as const },
      { liters: 3, reason: 'FRIEND_FIRST_ORDER', status: 'PENDING' as const }, // ignored
      { liters: 7, reason: 'ADMIN_ADJUSTMENT', status: 'REJECTED' as const }, // ignored
    ];
    expect(bonusBalanceFrom(rows)).toBe(5);
  });
  it('legacy rows without a status are treated as POSTED', () => {
    expect(bonusBalanceFrom([{ liters: 4, reason: 'FRIEND_FIRST_ORDER' }])).toBe(4);
  });
  it('a POSTED ADMIN_ADJUSTMENT credits the balance', () => {
    expect(
      bonusBalanceFrom([{ liters: 6, reason: 'ADMIN_ADJUSTMENT', status: 'POSTED' }]),
    ).toBe(6);
  });
});

describe('INVARIANT: the "10 friends" milestone counts ONLY POSTED', () => {
  it('excludes PENDING/REJECTED FRIEND_FIRST_ORDER rows', () => {
    const rows = [
      { liters: 1, reason: 'FRIEND_FIRST_ORDER', status: 'POSTED' as const },
      { liters: 1, reason: 'FRIEND_FIRST_ORDER', status: 'POSTED' as const },
      { liters: 1, reason: 'FRIEND_FIRST_ORDER', status: 'PENDING' as const },
      { liters: 1, reason: 'FRIEND_FIRST_ORDER', status: 'REJECTED' as const },
      { liters: 10, reason: 'TEN_FRIENDS_MILESTONE', status: 'POSTED' as const },
    ];
    expect(postedFriendFirstOrderCount(rows)).toBe(2);
  });
});

describe('INVARIANT: a frozen user can never spend bonus', () => {
  it('spendableBonus returns 0 when frozen, regardless of balance', () => {
    expect(spendableBonus(true, 50, 30)).toBe(0);
  });
  it('spends normally (capped at volume-1) when not frozen', () => {
    expect(spendableBonus(false, 50, 30)).toBe(29);
    expect(spendableBonus(false, 5, 30)).toBe(5);
  });
});

describe('INVARIANT: rate-cap — the 4th daily accrual is PENDING', () => {
  it('1st–3rd of the day are POSTED, the 4th+ are PENDING', () => {
    expect(accrualStatusForDay(0)).toBe('POSTED'); // 1st
    expect(accrualStatusForDay(1)).toBe('POSTED'); // 2nd
    expect(accrualStatusForDay(2)).toBe('POSTED'); // 3rd
    expect(accrualStatusForDay(3)).toBe('PENDING'); // 4th
    expect(accrualStatusForDay(4)).toBe('PENDING'); // 5th
    expect(FRIEND_FIRST_ORDER_DAILY_CAP).toBe(3);
  });
});
