import { describe, expect, it } from 'vitest';
import { averageRating, validateRating } from './order-rating';

describe('validateRating', () => {
  const base = { status: 'DELIVERED', existingRating: null };

  it('принимает 1–5 целых, один раз, только DELIVERED', () => {
    expect(validateRating({ ...base, rating: 5 })).toEqual({ ok: true, rating: 5, comment: null });
    expect(validateRating({ ...base, rating: 1, comment: ' норм ' })).toEqual({
      ok: true,
      rating: 1,
      comment: 'норм',
    });
  });

  it('не DELIVERED → not_delivered', () => {
    expect(validateRating({ ...base, status: 'IN_DELIVERY', rating: 5 })).toEqual({
      ok: false,
      error: 'not_delivered',
    });
  });

  it('повторная оценка → already_rated', () => {
    expect(validateRating({ ...base, existingRating: 4, rating: 5 })).toEqual({
      ok: false,
      error: 'already_rated',
    });
  });

  it('мусор отклоняется: 0, 6, дробные, строки', () => {
    for (const bad of [0, 6, 3.5, '5', null, undefined]) {
      expect(validateRating({ ...base, rating: bad })).toEqual({ ok: false, error: 'invalid' });
    }
  });
});

describe('averageRating', () => {
  it('среднее с округлением до 0.1; null без оценок', () => {
    expect(averageRating([5, 4, null, 4])).toBe(4.3);
    expect(averageRating([null, null])).toBeNull();
    expect(averageRating([])).toBeNull();
  });
});
