// Клиентская отмена заказа (финальный марафон, этап 1).
// Чистые правила вынесены сюда и покрыты тестами; роут только оркеструет.

export const CANCELLABLE_STATUSES = ['RECEIVED', 'SCHEDULED'] as const;

export const CANCEL_REASONS = [
  'CHANGED_MIND',
  'ORDERED_BY_MISTAKE',
  'PRICE',
  'WAIT_TOO_LONG',
  'OTHER',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export type CancelVerdict = 'ok' | 'courier_on_way' | 'not_cancellable';

/**
 * Можно ли клиенту отменить заказ в этом статусе. COURIER_ASSIGNED/IN_DELIVERY —
 * отдельный вердикт: UI показывает «курьер уже в пути, позвоните в поддержку».
 */
export function clientCancelVerdict(status: string): CancelVerdict {
  if ((CANCELLABLE_STATUSES as readonly string[]).includes(status)) return 'ok';
  if (status === 'COURIER_ASSIGNED' || status === 'IN_DELIVERY') return 'courier_on_way';
  return 'not_cancellable';
}

/** Комментарий обязателен только для OTHER; везде ограничен 200 символами. */
export function validateCancelInput(
  reason: string,
  comment: string | undefined,
): { ok: true; reason: CancelReason; comment: string | null } | { ok: false } {
  if (!(CANCEL_REASONS as readonly string[]).includes(reason)) return { ok: false };
  const trimmed = (comment ?? '').trim().slice(0, 200);
  if (reason === 'OTHER' && !trimmed) return { ok: false };
  return { ok: true, reason: reason as CancelReason, comment: trimmed || null };
}
