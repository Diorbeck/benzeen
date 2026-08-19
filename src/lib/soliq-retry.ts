// Очередь фискальных чеков — Модуль 5 ТЗ v2.
//
// Отправка чека в Солик не имеет права ломать заправку: деньги уже списаны и
// клиент уехал. Поэтому неудачная отправка не откатывает транзакцию, а попадает
// в очередь с выдержкой между повторами. Выдержка нужна не для красоты: если
// Солик лежит, обход раз в минуту превратится в тысячи бесполезных запросов и в
// журнал, в котором невозможно найти настоящую проблему.

const MINUTE = 60 * 1000;

/** Выдержка перед повтором по номеру попытки: 1, 5, 15, 60 минут, дальше 6 часов. */
export const SOLIQ_BACKOFF_MS: readonly number[] = [
  1 * MINUTE,
  5 * MINUTE,
  15 * MINUTE,
  60 * MINUTE,
  6 * 60 * MINUTE,
];

/**
 * После этого числа неудач чек перестаёт добираться автоматически и попадает в
 * ручной разбор. Молчаливые вечные повторы хуже явного «застряло»: АЗС считает,
 * что кассу за неё ведут, а чека в налоговой нет.
 */
export const MAX_SOLIQ_ATTEMPTS = 8;

export type ReceiptQueueState = {
  soliqSyncedAt: Date | null;
  soliqAttempts: number;
  soliqLastAttemptAt: Date | null;
};

export type ReceiptStatus = 'sent' | 'queued' | 'retrying' | 'stuck';

/** Задержка перед следующей попыткой. */
export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  const index = Math.min(attempts, SOLIQ_BACKOFF_MS.length) - 1;
  return SOLIQ_BACKOFF_MS[index];
}

/** Когда чек можно отправлять снова. */
export function nextRetryAt(state: ReceiptQueueState): Date | null {
  if (state.soliqSyncedAt) return null;
  if (state.soliqAttempts >= MAX_SOLIQ_ATTEMPTS) return null;
  const from = state.soliqLastAttemptAt;
  if (!from) return new Date(0);
  return new Date(from.getTime() + backoffMs(state.soliqAttempts));
}

/** Пора ли пробовать отправку этого чека. */
export function isRetryDue(state: ReceiptQueueState, now: Date = new Date()): boolean {
  const at = nextRetryAt(state);
  return at !== null && at.getTime() <= now.getTime();
}

/** Состояние чека для интерфейсов кабинета и админки. */
export function receiptStatus(state: ReceiptQueueState): ReceiptStatus {
  if (state.soliqSyncedAt) return 'sent';
  if (state.soliqAttempts >= MAX_SOLIQ_ATTEMPTS) return 'stuck';
  if (state.soliqAttempts > 0) return 'retrying';
  return 'queued';
}

/** Короткая, безопасная для журнала запись ошибки провайдера. */
export function shortError(e: unknown, limit = 200): string {
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return raw.replace(/\s+/g, ' ').slice(0, limit);
}
