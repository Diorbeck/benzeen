import { describe, it, expect, beforeEach } from 'vitest';
import {
  AcquiringError,
  getAcquirer,
  mockAcquirer,
  readApexConfig,
  resetMockAcquirer,
} from './acquiring';

const req = {
  sessionId: 'sess-1',
  amountUzs: 800_000,
  cardToken: 'tok_1',
  description: 'Заправка',
};

describe('мок эквайринга', () => {
  beforeEach(() => resetMockAcquirer());

  it('резерв, точное списание и возврат разницы', async () => {
    const held = await mockAcquirer.hold(req);
    expect(held.status).toBe('HELD');

    const captured = await mockAcquirer.capture(held.acquirerRef, 432_100);
    expect(captured.capturedUzs).toBe(432_100);
    expect(captured.refundedUzs).toBe(800_000 - 432_100);
  });

  it('повторное списание по той же транзакции не проходит', async () => {
    const held = await mockAcquirer.hold(req);
    await mockAcquirer.capture(held.acquirerRef, 100_000);
    await expect(mockAcquirer.capture(held.acquirerRef, 100_000)).rejects.toMatchObject({
      code: 'ALREADY_SETTLED',
    });
  });

  it('списание больше резерва отклоняется', async () => {
    const held = await mockAcquirer.hold(req);
    await expect(mockAcquirer.capture(held.acquirerRef, 900_000)).rejects.toMatchObject({
      code: 'AMOUNT_EXCEEDS_HOLD',
    });
  });

  it('размороженный резерв нельзя списать', async () => {
    const held = await mockAcquirer.hold(req);
    await mockAcquirer.release(held.acquirerRef);
    await expect(mockAcquirer.capture(held.acquirerRef, 10_000)).rejects.toMatchObject({
      code: 'ALREADY_SETTLED',
    });
  });

  it('неизвестная ссылка банка', async () => {
    await expect(mockAcquirer.release('нет такой')).rejects.toMatchObject({
      code: 'HOLD_NOT_FOUND',
    });
  });
});

describe('выбор провайдера', () => {
  it('без ключей и без явного мока — отказ, а не фиктивная оплата', () => {
    expect(() => getAcquirer({} as unknown as NodeJS.ProcessEnv)).toThrow(AcquiringError);
  });

  it('мок включается только явно', () => {
    const a = getAcquirer({ ACQUIRER_PROVIDER: 'mock' } as unknown as NodeJS.ProcessEnv);
    expect(a.id).toBe('mock');
  });

  it('ключи Apex дают адаптер Apex', () => {
    const a = getAcquirer({
      APEX_ACQUIRING_URL: 'https://sandbox.apex.uz',
      APEX_MERCHANT_ID: 'm1',
      APEX_SECRET: 's1',
    } as unknown as NodeJS.ProcessEnv);
    expect(a.id).toBe('apex');
  });

  it('адаптер Apex честно падает, пока протокол не подключён', async () => {
    const a = getAcquirer({
      APEX_ACQUIRING_URL: 'https://sandbox.apex.uz',
      APEX_MERCHANT_ID: 'm1',
      APEX_SECRET: 's1',
    } as unknown as NodeJS.ProcessEnv);
    await expect(a.hold(req)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('неполные ключи Apex не считаются настройкой', () => {
    expect(readApexConfig({ APEX_MERCHANT_ID: 'm1' } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
