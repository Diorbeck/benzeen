import { describe, expect, it } from 'vitest';
import { maskIdentifier } from './auth-audit';

describe('maskIdentifier (PR-D: без PII в журнале)', () => {
  it('телефон маскируется до префикса и последних 4 цифр', () => {
    expect(maskIdentifier('+998901234567')).toBe('+9989***4567');
  });
  it('почта — первая буква и домен', () => {
    expect(maskIdentifier('admin@benzeen.uz')).toBe('a***@benzeen.uz');
  });
  it('короткий мусор — полная маска', () => {
    expect(maskIdentifier('12345')).toBe('***');
  });
});
