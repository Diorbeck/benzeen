import { describe, it, expect } from 'vitest';
import { getProgressColor } from './utils';

describe('getProgressColor', () => {
  it('returns success when usage < 70% of limit', () => {
    expect(getProgressColor(50, 100)).toBe('success');
    expect(getProgressColor(0, 100)).toBe('success');
    expect(getProgressColor(69, 100)).toBe('success');
  });

  it('returns warning when usage 70-90% of limit', () => {
    expect(getProgressColor(70, 100)).toBe('warning');
    expect(getProgressColor(80, 100)).toBe('warning');
    expect(getProgressColor(89, 100)).toBe('warning');
  });

  it('returns danger when usage >= 90% of limit', () => {
    expect(getProgressColor(90, 100)).toBe('danger');
    expect(getProgressColor(95, 100)).toBe('danger');
    expect(getProgressColor(100, 100)).toBe('danger');
  });

  it('returns success when limit is 0', () => {
    expect(getProgressColor(10, 0)).toBe('success');
  });

  it('returns warning when usage 80-89%', () => {
    expect(getProgressColor(85, 100)).toBe('warning');
    expect(getProgressColor(81, 100)).toBe('warning');
  });
});
