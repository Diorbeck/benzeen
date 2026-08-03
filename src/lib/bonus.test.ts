import { describe, it, expect } from 'vitest';
import { computeBonusUsed, computeTotal, bonusBalanceFrom } from './bonus';

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
