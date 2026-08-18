// Заправка на стационарной АЗС: расчёт резерва, разбор данных с колонки и
// правила закрытия сессии — Модули 2 и 4 ТЗ v2.
//
// Логика вынесена из роутов в чистые функции намеренно: деньги клиента считаются
// здесь, и это единственное место в проекте, которое обязано быть покрыто
// тестами целиком. Роуты остаются тонкими — валидация входа и запись в базу.

/** Кешбек клиенту через Солик — 1% от суммы транзакции (ТЗ, Модуль 5). */
export const CASHBACK_RATE = 0.01;

/**
 * Запас к резерву при заправке «полный бак»: точную сумму до начала заливки
 * знать невозможно, поэтому холдируется потолок. Значение не берётся с потолка —
 * это объём бака легковой машины по максимуму (80 л) на цену литра.
 */
export const FULL_TANK_LITERS_CAP = 80;

/**
 * Сколько ждать связь, прежде чем разморозить резерв и отправить заливку на
 * ручную сверку по логу колонки (ТЗ, Модуль 4: 15–30 минут).
 */
export const OFFLINE_HOLD_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Через сколько молчания колонки заливка считается завершённой. Контроллер шлёт
 * тик на каждый литр; если тиков нет минуту, пистолет уже вынут, а финальный
 * пакет потерялся по дороге.
 */
export const FLOW_IDLE_TIMEOUT_MS = 60 * 1000;

/** Минимальный резерв: холд на 2 000 сум банк просто не пропустит. */
export const MIN_HOLD_UZS = 10_000;

export type FuelingRequest = {
  /** Клиент попросил литры. */
  liters?: number | null;
  /** Клиент попросил сумму. */
  amountUzs?: number | null;
  /** Полный бак — оба поля выше пустые. */
  fullTank?: boolean;
};

export type HoldPlan = {
  holdAmountUzs: number;
  /** Ожидаемые литры — нужны колонке как лимит отпуска. */
  limitLiters: number;
  mode: 'LITERS' | 'AMOUNT' | 'FULL_TANK';
};

export class FuelingError extends Error {
  constructor(
    readonly code:
      | 'NO_PRICE'
      | 'BAD_REQUEST'
      | 'AMOUNT_TOO_SMALL'
      | 'NOT_ENOUGH_FUEL'
      | 'DISPENSER_BUSY',
    message: string,
  ) {
    super(message);
    this.name = 'FuelingError';
  }
}

/**
 * Сколько холдировать до начала заливки.
 *
 * Резерв всегда считается по цене АЗС на момент старта: цену ставит сама АЗС, и
 * если она сменится посреди заливки, клиент не должен узнать об этом из чека.
 */
export function planHold(req: FuelingRequest, priceUzs: number, availableLiters: number): HoldPlan {
  if (!Number.isFinite(priceUzs) || priceUzs <= 0) {
    throw new FuelingError('NO_PRICE', 'Цена топлива на АЗС не задана');
  }

  const liters = req.liters ?? null;
  const amount = req.amountUzs ?? null;

  if (liters !== null && amount !== null) {
    throw new FuelingError('BAD_REQUEST', 'Укажите либо литры, либо сумму');
  }

  if (liters !== null) {
    if (!Number.isFinite(liters) || liters <= 0) {
      throw new FuelingError('BAD_REQUEST', 'Некорректный объём');
    }
    if (liters > availableLiters) {
      throw new FuelingError('NOT_ENOUGH_FUEL', 'На АЗС меньше топлива, чем запрошено');
    }
    const hold = Math.ceil(liters * priceUzs);
    return { holdAmountUzs: Math.max(hold, MIN_HOLD_UZS), limitLiters: liters, mode: 'LITERS' };
  }

  if (amount !== null) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new FuelingError('BAD_REQUEST', 'Некорректная сумма');
    }
    if (amount < MIN_HOLD_UZS) {
      throw new FuelingError('AMOUNT_TOO_SMALL', `Минимальная сумма — ${MIN_HOLD_UZS} сум`);
    }
    const limit = amount / priceUzs;
    if (limit > availableLiters) {
      throw new FuelingError('NOT_ENOUGH_FUEL', 'На АЗС меньше топлива, чем на эту сумму');
    }
    return { holdAmountUzs: Math.ceil(amount), limitLiters: limit, mode: 'AMOUNT' };
  }

  // Полный бак: холдируем потолок и возвращаем разницу после заливки.
  const limit = Math.min(FULL_TANK_LITERS_CAP, availableLiters);
  if (limit <= 0) {
    throw new FuelingError('NOT_ENOUGH_FUEL', 'На АЗС нет этого топлива');
  }
  const hold = Math.ceil(limit * priceUzs);
  return { holdAmountUzs: Math.max(hold, MIN_HOLD_UZS), limitLiters: limit, mode: 'FULL_TANK' };
}

export type FlowTick = {
  liters: number;
  /** Сумма с экрана колонки, если контроллер её отдаёт. */
  amountUzs?: number | null;
};

export type FlowState = {
  liters: number;
  amountUzs: number;
  /** Достигнут лимит отпуска — колонке пора останавливаться. */
  limitReached: boolean;
};

/**
 * Пересчёт живого состояния заливки.
 *
 * Сумму считаем сами по цене старта, даже если колонка присылает свою: расхождение
 * копеек между её округлением и нашим не должно превратиться в спор с клиентом.
 * Данные колонки при этом сохраняются как есть — они доказательная база.
 */
export function applyTick(tick: FlowTick, priceUzs: number, limitLiters: number): FlowState {
  const liters = Math.max(0, Number.isFinite(tick.liters) ? tick.liters : 0);
  const capped = Math.min(liters, limitLiters);
  return {
    liters: capped,
    amountUzs: Math.round(capped * priceUzs),
    limitReached: liters >= limitLiters - 1e-6,
  };
}

export type Settlement = {
  /** Точная сумма к списанию по факту залитых литров. */
  captureUzs: number;
  /** Что вернётся клиенту из резерва. */
  refundUzs: number;
  /** Кешбек 1% через Солик. */
  cashbackUzs: number;
};

/**
 * Итог заливки: сколько списать, сколько вернуть, сколько кешбека начислить.
 *
 * Списание никогда не превышает резерв — банк такой capture отклонит, а клиент
 * увидит «ошибка оплаты» вместо заправки. Если колонка отпустила больше, чем
 * было захолдировано (перелив), разница уходит в счёт АЗС, а не в долг клиенту:
 * контроль лимита — обязанность колонки, не водителя.
 */
export function settle(
  litersDispensed: number,
  priceUzs: number,
  holdAmountUzs: number,
): Settlement {
  const liters = Math.max(0, Number.isFinite(litersDispensed) ? litersDispensed : 0);
  const exact = Math.round(liters * priceUzs);
  const capture = Math.min(exact, holdAmountUzs);
  return {
    captureUzs: capture,
    refundUzs: Math.max(0, holdAmountUzs - capture),
    cashbackUzs: Math.floor(capture * CASHBACK_RATE),
  };
}

export type StaleSession = {
  status: 'RESERVED' | 'FLOWING';
  startedAt: Date;
  /** Последний тик с колонки, если он был. */
  lastTickAt: Date | null;
  litersDispensed: number | null;
};

export type StaleDecision =
  | { action: 'KEEP' }
  | { action: 'CANCEL'; reason: 'NEVER_STARTED' }
  | { action: 'COMPLETE'; reason: 'FLOW_IDLE' }
  | { action: 'MANUAL_REVIEW'; reason: 'CONNECTION_LOST' };

/**
 * Что делать с зависшей сессией.
 *
 * Три разных случая, которые нельзя схлопывать в один: пистолет так и не
 * вставили (резерв просто разморозить), заливка кончилась и колонка замолчала
 * (закрыть по последним литрам), связь с объектом пропала надолго (разморозить
 * резерв и отправить на сверку по логу колонки — ТЗ, Модуль 4).
 */
export function decideStale(s: StaleSession, now: Date = new Date()): StaleDecision {
  const age = now.getTime() - s.startedAt.getTime();
  const liters = s.litersDispensed ?? 0;

  if (s.status === 'RESERVED' && liters <= 0) {
    return age >= OFFLINE_HOLD_TIMEOUT_MS
      ? { action: 'CANCEL', reason: 'NEVER_STARTED' }
      : { action: 'KEEP' };
  }

  const idle = s.lastTickAt ? now.getTime() - s.lastTickAt.getTime() : age;

  if (idle >= OFFLINE_HOLD_TIMEOUT_MS) {
    // Литры есть, но связь давно молчит: сумму по такому обрывку признавать
    // нельзя — только ручная сверка.
    return { action: 'MANUAL_REVIEW', reason: 'CONNECTION_LOST' };
  }

  if (liters > 0 && idle >= FLOW_IDLE_TIMEOUT_MS) {
    return { action: 'COMPLETE', reason: 'FLOW_IDLE' };
  }

  return { action: 'KEEP' };
}
