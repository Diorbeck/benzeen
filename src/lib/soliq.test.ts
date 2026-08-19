import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildFiscalReceipt,
  getSoliqProvider,
  mockSoliqProvider,
  readSoliqConfig,
  resetMockSoliq,
  SoliqError,
} from './soliq';

const base = {
  sessionId: 'sess-1',
  stationId: 'demo-station-1',
  stationName: 'АЗС Юнусабад',
  stationTin: '301234567',
  dispenserNumber: 2,
  fuelName: 'АИ-95',
  liters: 32.456,
  priceUzs: 15_800,
  amountUzs: 512_800,
  acquirerRef: 'mock_sess-1',
  clientId: 'client-1',
  settledAt: new Date('2026-08-19T02:00:00.000Z'),
};

describe('чек для Солик', () => {
  it('переносит факт заправки в позицию чека', () => {
    const r = buildFiscalReceipt(base);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].name).toBe('АИ-95');
    expect(r.lines[0].priceUzs).toBe(15_800);
    expect(r.stationTin).toBe('301234567');
    expect(r.paymentType).toBe('CARD');
    expect(r.settledAt).toBe('2026-08-19T02:00:00.000Z');
  });

  it('литры округляет до сотых, как счётчик колонки', () => {
    expect(buildFiscalReceipt(base).lines[0].quantity).toBe(32.46);
  });

  it('сумма чека равна фактически списанной, а не пересчитанной из литров', () => {
    const r = buildFiscalReceipt(base);
    expect(r.totalUzs).toBe(512_800);
    expect(r.lines[0].totalUzs).toBe(512_800);
  });

  it('считает кешбек 1% вниз до сума', () => {
    expect(buildFiscalReceipt(base).cashbackUzs).toBe(5_128);
    expect(buildFiscalReceipt({ ...base, amountUzs: 99 }).cashbackUzs).toBe(0);
  });

  it('не выставляет чек на нулевую сумму', () => {
    expect(() => buildFiscalReceipt({ ...base, amountUzs: 0 })).toThrow(SoliqError);
  });

  it('не выставляет чек без залитых литров', () => {
    expect(() => buildFiscalReceipt({ ...base, liters: 0 })).toThrow(SoliqError);
  });

  it('работает без ИНН и без ссылки банка', () => {
    const r = buildFiscalReceipt({ ...base, stationTin: null, acquirerRef: null, clientId: null });
    expect(r.stationTin).toBeNull();
    expect(r.acquirerRef).toBeNull();
    expect(r.clientId).toBeNull();
  });
});

describe('провайдер Солик', () => {
  beforeEach(() => resetMockSoliq());

  it('повторная отправка того же чека не создаёт дубль', async () => {
    const receipt = buildFiscalReceipt(base);
    const first = await mockSoliqProvider.submit(receipt);
    const second = await mockSoliqProvider.submit(receipt);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.fiscalId).toBe(first.fiscalId);
  });

  it('без настроек возвращает null, а не падает', () => {
    expect(getSoliqProvider({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it('мок включается только явным флагом', () => {
    expect(getSoliqProvider({ SOLIQ_PROVIDER: 'mock' } as unknown as NodeJS.ProcessEnv)?.id).toBe('mock');
  });

  it('читает конфиг только при всех трёх переменных', () => {
    expect(readSoliqConfig({ SOLIQ_API_URL: 'https://x', SOLIQ_TIN: '1' } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(
      readSoliqConfig({
        SOLIQ_API_URL: 'https://x',
        SOLIQ_TIN: '1',
        SOLIQ_SECRET: 's',
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ baseUrl: 'https://x', tin: '1', secret: 's' });
  });

  it('настоящий адаптер честно сообщает, что протокол не подключён', async () => {
    const p = getSoliqProvider({
      SOLIQ_API_URL: 'https://soliq.uz',
      SOLIQ_TIN: '301234567',
      SOLIQ_SECRET: 's',
    } as unknown as NodeJS.ProcessEnv);
    await expect(p!.submit(buildFiscalReceipt(base))).rejects.toThrow(/не подключён/);
  });
});
