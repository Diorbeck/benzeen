// Этап 2: оценка доставки. Чистые правила, покрыты тестами.

export type RatingVerdict =
  | { ok: true; rating: number; comment: string | null }
  | { ok: false; error: 'invalid' | 'not_delivered' | 'already_rated' };

/** 1–5 звёзд, один раз, только по DELIVERED. Комментарий необязателен (≤500). */
export function validateRating(args: {
  status: string;
  existingRating: number | null;
  rating: unknown;
  comment?: unknown;
}): RatingVerdict {
  if (args.status !== 'DELIVERED') return { ok: false, error: 'not_delivered' };
  if (args.existingRating !== null) return { ok: false, error: 'already_rated' };
  const r = args.rating;
  if (typeof r !== 'number' || !Number.isInteger(r) || r < 1 || r > 5) {
    return { ok: false, error: 'invalid' };
  }
  const comment =
    typeof args.comment === 'string' ? args.comment.trim().slice(0, 500) : '';
  return { ok: true, rating: r, comment: comment || null };
}

/** Средний рейтинг курьера по оценённым заказам (null — нет оценок). */
export function averageRating(ratings: Array<number | null>): number | null {
  const vals = ratings.filter((r): r is number => typeof r === 'number');
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
