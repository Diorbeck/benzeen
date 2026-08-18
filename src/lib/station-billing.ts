import { DISPENSER_DAILY_RATE_UZS, TANK_DAILY_RATE_UZS } from './stations';

// --- v2: подписка АЗС ---
//
// Бизнес-модель — не комиссия с оборота, а суточная ставка за инфраструктуру:
// 25 000 сум/сутки за резервуар (датчик обязателен) и 10 000 сум/сутки за
// колонку с идентификацией клиента (опция). Счёт выставляется один раз в
// начале месяца за месяц, который закончился.

export type BillingItem = 'TANK' | 'DISPENSER';

export type SubscriptionPeriod = {
  item: BillingItem;
  dailyRateUzs: number;
  startedAt: Date;
  /** null — подписка ещё активна. */
  endedAt: Date | null;
};

export type InvoiceDraft = {
  periodStart: Date;
  periodEnd: Date;
  tankDays: number;
  dispenserDays: number;
  amountUzs: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Первое число месяца, в который попадает дата, в UTC. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Первое число следующего месяца — правая граница периода, не включается. */
export function monthEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

// Сутки подписки внутри расчётного периода. Начатые сутки считаются целиком:
// иначе АЗС, подключившая датчик в 23:50, заплатила бы за 10 минут, и весь
// биллинг превратился бы в спор о минутах. Округление вверх — в пользу
// понятности, и об этом сказано в счёте.
export function billableDays(
  period: SubscriptionPeriod,
  periodStart: Date,
  periodEnd: Date,
): number {
  const from = Math.max(period.startedAt.getTime(), periodStart.getTime());
  const to = Math.min(period.endedAt?.getTime() ?? periodEnd.getTime(), periodEnd.getTime());
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.ceil((to - from) / DAY_MS);
}

// Черновик счёта за период. Ставка берётся из строки подписки, а не из
// константы: если тариф изменится, старые счёта должны оставаться
// пересчитываемыми по той цене, по которой они были выставлены.
export function buildInvoiceDraft(
  subscriptions: readonly SubscriptionPeriod[],
  periodStart: Date,
  periodEnd: Date,
): InvoiceDraft {
  let tankDays = 0;
  let dispenserDays = 0;
  let amountUzs = 0;

  for (const sub of subscriptions) {
    const days = billableDays(sub, periodStart, periodEnd);
    if (days === 0) continue;

    if (sub.item === 'TANK') tankDays += days;
    else dispenserDays += days;

    amountUzs += days * sub.dailyRateUzs;
  }

  return { periodStart, periodEnd, tankDays, dispenserDays, amountUzs };
}

/** Ставка по умолчанию для новой подписки. */
export function defaultDailyRate(item: BillingItem): number {
  return item === 'TANK' ? TANK_DAILY_RATE_UZS : DISPENSER_DAILY_RATE_UZS;
}
