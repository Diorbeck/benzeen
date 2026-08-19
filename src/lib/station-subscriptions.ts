import { DISPENSER_DAILY_RATE_UZS, TANK_DAILY_RATE_UZS } from './stations';
import type { BillingItem } from './station-billing';

// Модуль 7 ТЗ v2: управление подключениями и тарифами. Подписка АЗС состоит из
// строк по конкретным объектам: резервуар (датчик обязателен, 25 000 сум/сутки)
// и колонка с идентификацией клиента (опция, 10 000 сум/сутки).
//
// Строку подписки нельзя удалять: закрытый период нужен для пересчёта уже
// выставленных счетов. Поэтому «отключить» — это проставить endedAt, а
// «подключить» — открыть новую строку с текущей ставкой.

export type SubscriptionRow = {
  id: string;
  item: BillingItem;
  tankId: string | null;
  dispenserId: string | null;
  dailyRateUzs: number;
  startedAt: Date;
  endedAt: Date | null;
};

export type SubscriptionTarget = {
  /** Идентификатор резервуара или колонки. */
  id: string;
  item: BillingItem;
  /** Как объект называется на АЗС: метка резервуара или номер колонки. */
  label: string;
};

export type TargetSubscriptionState = {
  target: SubscriptionTarget;
  /** Активная строка подписки, если объект сейчас в счёте. */
  active: SubscriptionRow | null;
  /** Ставка, по которой объект тарифицируется или будет тарифицирован. */
  dailyRateUzs: number;
};

/** Ставка по умолчанию для нового подключения. */
export function defaultDailyRate(item: BillingItem): number {
  return item === 'TANK' ? TANK_DAILY_RATE_UZS : DISPENSER_DAILY_RATE_UZS;
}

/**
 * Активная строка подписки по объекту на момент `now`.
 *
 * Строк по одному объекту может быть несколько (подключали, отключали,
 * подключили снова), поэтому берём последнюю открытую по времени начала.
 */
export function activeSubscription(
  rows: readonly SubscriptionRow[],
  target: SubscriptionTarget,
  now: Date = new Date(),
): SubscriptionRow | null {
  const matching = rows.filter((row) => {
    const sameTarget = target.item === 'TANK' ? row.tankId === target.id : row.dispenserId === target.id;
    if (!sameTarget || row.item !== target.item) return false;
    if (row.startedAt.getTime() > now.getTime()) return false;
    return row.endedAt === null || row.endedAt.getTime() > now.getTime();
  });
  if (matching.length === 0) return null;
  return matching.reduce((latest, row) =>
    row.startedAt.getTime() > latest.startedAt.getTime() ? row : latest,
  );
}

/** Состояние подписки по каждому объекту АЗС — то, что рисуется в админке. */
export function buildSubscriptionStates(
  targets: readonly SubscriptionTarget[],
  rows: readonly SubscriptionRow[],
  now: Date = new Date(),
): TargetSubscriptionState[] {
  return targets.map((target) => {
    const active = activeSubscription(rows, target, now);
    return {
      target,
      active,
      dailyRateUzs: active?.dailyRateUzs ?? defaultDailyRate(target.item),
    };
  });
}

/** Суточная стоимость подписки АЗС по текущим подключениям. */
export function dailyChargeUzs(states: readonly TargetSubscriptionState[]): number {
  return states.reduce((sum, state) => (state.active ? sum + state.dailyRateUzs : sum), 0);
}

export type RateChange = { ok: true; dailyRateUzs: number } | { ok: false; error: string };

/**
 * Проверка ставки, которую админ вводит руками.
 *
 * Ставка задаётся в целых сумах и не может быть нулевой: подписка с нулевой
 * ставкой выглядела бы как подключение, но не попадала бы в счёт, и расхождение
 * нашлось бы только при сверке с банком.
 */
export function validateDailyRate(value: unknown): RateChange {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) return { ok: false, error: 'Rate is not a number' };
  if (!Number.isInteger(num)) return { ok: false, error: 'Rate must be an integer' };
  if (num <= 0) return { ok: false, error: 'Rate must be positive' };
  if (num > 10_000_000) return { ok: false, error: 'Rate is too large' };
  return { ok: true, dailyRateUzs: num };
}
