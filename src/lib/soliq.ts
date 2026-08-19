// Интеграция с налоговой (Солик) — Модуль 5 ТЗ v2.
//
// Смысл модуля: чек по заправке уходит в Солик вместо бумажного/кассового, АЗС
// перестаёт вести кассу по операциям через Benzeen, а клиент получает кешбек 1%
// от суммы транзакции в приложении Солик.
//
// Провайдер спрятан за интерфейсом по той же причине, что и эквайринг: доступа к
// API Солик на момент написания кода нет, но состав чека, идемпотентность и
// очередь повторной отправки от их протокола не зависят и должны быть готовы и
// протестированы заранее. Когда придёт спецификация — меняется один адаптер.
//
// Важное продуктовое правило: отправка чека не имеет права ломать заправку.
// Деньги списаны, клиент уехал — чек догоняется очередью, а не откатывает
// транзакцию.

import { CASHBACK_RATE } from './fueling';

/** Позиция чека. У заправки она всегда одна — топливо. */
export type ReceiptLine = {
  name: string;
  /** Литры, с точностью до 0.01 — как на счётчике колонки. */
  quantity: number;
  /** Цена за литр в сумах на момент заливки. */
  priceUzs: number;
  /** quantity × priceUzs, округлённое до сума. */
  totalUzs: number;
};

export type FiscalReceipt = {
  /** Наш идентификатор сессии — он же ключ идемпотентности для Солик. */
  sessionId: string;
  stationId: string;
  stationName: string;
  stationTin: string | null;
  dispenserNumber: number;
  lines: ReceiptLine[];
  totalUzs: number;
  /** Кешбек клиенту 1% — начисляет Солик по нашему чеку. */
  cashbackUzs: number;
  /** Способ оплаты: наличных в схеме нет по определению. */
  paymentType: 'CARD';
  /** Ссылка банка на транзакцию — по ней налоговая сверяет платёж. */
  acquirerRef: string | null;
  clientId: string | null;
  settledAt: string;
};

export type ReceiptInput = {
  sessionId: string;
  stationId: string;
  stationName: string;
  stationTin?: string | null;
  dispenserNumber: number;
  fuelName: string;
  liters: number;
  priceUzs: number;
  amountUzs: number;
  acquirerRef?: string | null;
  clientId?: string | null;
  settledAt: Date;
};

export class SoliqError extends Error {
  constructor(
    readonly code: 'NOT_CONFIGURED' | 'REJECTED' | 'PROVIDER_UNAVAILABLE' | 'BAD_RECEIPT',
    message: string,
  ) {
    super(message);
    this.name = 'SoliqError';
  }
}

/**
 * Сборка чека из фактов заправки.
 *
 * Сумма чека берётся из фактически списанного, а не пересчитывается из литров:
 * округление уже сделано при закрытии сессии, и второй раунд округления дал бы
 * чек, расходящийся с суммой на карте на сум-два — именно то, из-за чего
 * налоговая и клиент считают чек недействительным.
 */
export function buildFiscalReceipt(input: ReceiptInput): FiscalReceipt {
  if (input.amountUzs <= 0) {
    throw new SoliqError('BAD_RECEIPT', 'Чек на нулевую сумму не выставляется');
  }
  if (input.liters <= 0) {
    throw new SoliqError('BAD_RECEIPT', 'Чек без залитых литров не выставляется');
  }

  const quantity = Math.round(input.liters * 100) / 100;

  return {
    sessionId: input.sessionId,
    stationId: input.stationId,
    stationName: input.stationName,
    stationTin: input.stationTin ?? null,
    dispenserNumber: input.dispenserNumber,
    lines: [
      {
        name: input.fuelName,
        quantity,
        priceUzs: input.priceUzs,
        totalUzs: input.amountUzs,
      },
    ],
    totalUzs: input.amountUzs,
    cashbackUzs: Math.floor(input.amountUzs * CASHBACK_RATE),
    paymentType: 'CARD',
    acquirerRef: input.acquirerRef ?? null,
    clientId: input.clientId ?? null,
    settledAt: input.settledAt.toISOString(),
  };
}

export type SoliqSubmitResult = {
  /** Фискальный номер чека в системе Солик. */
  fiscalId: string;
  /** true, если чек с таким sessionId уже был принят раньше. */
  duplicate: boolean;
};

export interface SoliqProvider {
  readonly id: string;
  /**
   * Отправить чек. Обязан быть идемпотентным по sessionId: контроллер и наша
   * очередь вправе повторить отправку, и дубль чека в налоговой недопустим.
   */
  submit(receipt: FiscalReceipt): Promise<SoliqSubmitResult>;
}

// ---------------------------------------------------------------------------
// Мок для разработки и пилота.
//
// Включается только явным SOLIQ_PROVIDER=mock. Молчаливая заглушка в фискальных
// чеках так же опасна, как и в платежах: АЗС будет считать, что кассу за неё
// ведут, а чеков в налоговой не окажется.
// ---------------------------------------------------------------------------

type MockStore = { __benzeenSoliqReceipts?: Map<string, string> };
const mockStore = globalThis as unknown as MockStore;
const mockReceipts: Map<string, string> = (mockStore.__benzeenSoliqReceipts ??= new Map());

export const mockSoliqProvider: SoliqProvider = {
  id: 'mock',
  async submit(receipt) {
    const existing = mockReceipts.get(receipt.sessionId);
    if (existing) return { fiscalId: existing, duplicate: true };
    const fiscalId = `mock-fs-${receipt.sessionId}`;
    mockReceipts.set(receipt.sessionId, fiscalId);
    return { fiscalId, duplicate: false };
  },
};

/** Для тестов: мок держит принятые чеки в памяти процесса. */
export function resetMockSoliq(): void {
  mockReceipts.clear();
}

// ---------------------------------------------------------------------------
// Солик — адаптер-заготовка.
// ---------------------------------------------------------------------------

export type SoliqConfig = {
  baseUrl: string;
  /** ИНН налогоплательщика, от имени которого выставляется чек. */
  tin: string;
  secret: string;
};

export function readSoliqConfig(env: NodeJS.ProcessEnv = process.env): SoliqConfig | null {
  const baseUrl = env.SOLIQ_API_URL;
  const tin = env.SOLIQ_TIN;
  const secret = env.SOLIQ_SECRET;
  if (!baseUrl || !tin || !secret) return null;
  return { baseUrl, tin, secret };
}

export function createSoliqProvider(config: SoliqConfig): SoliqProvider {
  return {
    id: 'soliq',
    async submit() {
      throw new SoliqError(
        'NOT_CONFIGURED',
        `Протокол Солик ещё не подключён (ИНН ${config.tin})`,
      );
    },
  };
}

/**
 * Активный провайдер или null, если налоговая интеграция не настроена.
 *
 * null здесь — рабочее состояние, а не ошибка: до подключения Солик заправки
 * должны идти как есть, просто без фискального чека. Поэтому вызывающий код
 * обязан уметь работать без провайдера, а не падать.
 */
export function getSoliqProvider(env: NodeJS.ProcessEnv = process.env): SoliqProvider | null {
  if (env.SOLIQ_PROVIDER === 'mock') return mockSoliqProvider;
  const config = readSoliqConfig(env);
  return config ? createSoliqProvider(config) : null;
}
