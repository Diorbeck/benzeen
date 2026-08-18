// Эквайринг для заправки на стационарной АЗС — Модуль 4 ТЗ v2.
//
// Двухфазная транзакция: резерв (hold) до начала заливки и точное списание
// (capture) по факту залитых литров, разница возвращается автоматически.
//
// Провайдер спрятан за интерфейсом сознательно. Договор с Apex Bank и доступ к
// их песочнице на момент написания кода ещё не подписаны, а весь остальной
// сценарий — резерв, живой экран, закрытие, возврат — от банка не зависит и
// должен собираться и тестироваться уже сейчас. Когда придёт спецификация Apex,
// меняется один файл-адаптер, а не бизнес-логика.
//
// Платёжных данных карты у нас нет и не будет: PCI DSS-совместимый флоу означает,
// что карта живёт на стороне банка, а у нас — только его ссылка на транзакцию.

export type HoldRequest = {
  /** Наш идентификатор сессии заправки — попадает в назначение платежа. */
  sessionId: string;
  amountUzs: number;
  /** Токен карты клиента на стороне банка. Номера карты у нас нет. */
  cardToken: string;
  description: string;
};

export type HoldResult = {
  /** Ссылка банка на транзакцию: по ней делаются capture и release. */
  acquirerRef: string;
  status: 'HELD';
};

export type CaptureResult = {
  acquirerRef: string;
  capturedUzs: number;
  refundedUzs: number;
  status: 'CAPTURED';
};

export class AcquiringError extends Error {
  constructor(
    readonly code:
      | 'NOT_CONFIGURED'
      | 'DECLINED'
      | 'HOLD_NOT_FOUND'
      | 'ALREADY_SETTLED'
      | 'AMOUNT_EXCEEDS_HOLD'
      | 'PROVIDER_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'AcquiringError';
  }
}

export interface Acquirer {
  readonly id: string;
  /** Заморозить сумму на карте до начала заливки. */
  hold(req: HoldRequest): Promise<HoldResult>;
  /**
   * Списать фактическую сумму и вернуть разницу.
   * Списание больше резерва запрещено на нашей стороне — банк такой запрос
   * всё равно отклонит, а клиент увидел бы «ошибка оплаты» вместо чека.
   */
  capture(acquirerRef: string, amountUzs: number): Promise<CaptureResult>;
  /** Разморозить резерв целиком: клиент отменил или связь не вернулась. */
  release(acquirerRef: string): Promise<{ acquirerRef: string; status: 'RELEASED' }>;
}

// ---------------------------------------------------------------------------
// Мок для разработки и пилота без банка.
//
// Держит резервы в памяти процесса. Этого достаточно, чтобы прогнать весь
// сценарий на dev-окружении и на демо АЗС, и заведомо мало для продакшна —
// поэтому мок включается только явным ACQUIRER_PROVIDER=mock.
// ---------------------------------------------------------------------------

type MockHold = { amountUzs: number; settled: boolean };

// Состояние живёт на globalThis, а не в модуле: в dev-режиме Next перезагружает
// модули между запросами, и обычная Map теряла бы резерв между его созданием и
// закрытием — заправка падала бы на «резерв не найден» на ровном месте.
const mockHoldStore = globalThis as unknown as { __benzeenMockHolds?: Map<string, MockHold> };
const mockHolds: Map<string, MockHold> = (mockHoldStore.__benzeenMockHolds ??= new Map());

export const mockAcquirer: Acquirer = {
  id: 'mock',

  async hold(req) {
    if (req.amountUzs <= 0) {
      throw new AcquiringError('DECLINED', 'Некорректная сумма резерва');
    }
    const ref = `mock_${req.sessionId}`;
    mockHolds.set(ref, { amountUzs: req.amountUzs, settled: false });
    return { acquirerRef: ref, status: 'HELD' };
  },

  async capture(ref, amountUzs) {
    const held = mockHolds.get(ref);
    if (!held) throw new AcquiringError('HOLD_NOT_FOUND', 'Резерв не найден');
    if (held.settled) throw new AcquiringError('ALREADY_SETTLED', 'Транзакция уже закрыта');
    if (amountUzs > held.amountUzs) {
      throw new AcquiringError('AMOUNT_EXCEEDS_HOLD', 'Списание больше резерва');
    }
    held.settled = true;
    return {
      acquirerRef: ref,
      capturedUzs: amountUzs,
      refundedUzs: held.amountUzs - amountUzs,
      status: 'CAPTURED',
    };
  },

  async release(ref) {
    const held = mockHolds.get(ref);
    if (!held) throw new AcquiringError('HOLD_NOT_FOUND', 'Резерв не найден');
    if (held.settled) throw new AcquiringError('ALREADY_SETTLED', 'Транзакция уже закрыта');
    held.settled = true;
    return { acquirerRef: ref, status: 'RELEASED' };
  },
};

/** Для тестов: мок живёт в памяти модуля, между кейсами его надо чистить. */
export function resetMockAcquirer(): void {
  mockHolds.clear();
}

// ---------------------------------------------------------------------------
// Apex Bank — адаптер-заготовка.
//
// Заполняется по спецификации банка после подписания NDA и получения доступа к
// песочнице. До этого момента он честно падает с NOT_CONFIGURED, а не делает вид,
// что оплата прошла: молчаливая заглушка в платежах опаснее ошибки.
// ---------------------------------------------------------------------------

export type ApexConfig = {
  baseUrl: string;
  merchantId: string;
  secret: string;
};

export function readApexConfig(env: NodeJS.ProcessEnv = process.env): ApexConfig | null {
  const baseUrl = env.APEX_ACQUIRING_URL;
  const merchantId = env.APEX_MERCHANT_ID;
  const secret = env.APEX_SECRET;
  if (!baseUrl || !merchantId || !secret) return null;
  return { baseUrl, merchantId, secret };
}

export function createApexAcquirer(config: ApexConfig): Acquirer {
  return {
    id: 'apex',
    async hold() {
      throw new AcquiringError(
        'NOT_CONFIGURED',
        `Протокол эквайринга Apex Bank ещё не подключён (${config.merchantId})`,
      );
    },
    async capture() {
      throw new AcquiringError('NOT_CONFIGURED', 'Протокол эквайринга Apex Bank ещё не подключён');
    },
    async release() {
      throw new AcquiringError('NOT_CONFIGURED', 'Протокол эквайринга Apex Bank ещё не подключён');
    },
  };
}

/**
 * Активный провайдер.
 *
 * По умолчанию — Apex, если его ключи есть в окружении. Мок включается только
 * явно: провайдер оплаты, выбранный «по умолчанию, потому что ключей нет» — это
 * ровно тот способ, которым в прод попадает фиктивная оплата.
 */
export function getAcquirer(env: NodeJS.ProcessEnv = process.env): Acquirer {
  if (env.ACQUIRER_PROVIDER === 'mock') return mockAcquirer;
  const apex = readApexConfig(env);
  if (apex) return createApexAcquirer(apex);
  throw new AcquiringError(
    'NOT_CONFIGURED',
    'Эквайринг не настроен: задайте ключи Apex Bank или ACQUIRER_PROVIDER=mock',
  );
}
