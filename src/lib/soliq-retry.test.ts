import { describe, expect, it } from 'vitest';
import {
  MAX_SOLIQ_ATTEMPTS,
  backoffMs,
  isRetryDue,
  nextRetryAt,
  receiptStatus,
  shortError,
} from './soliq-retry';
import { SoliqError } from './soliq';

const MINUTE = 60 * 1000;
const T0 = new Date('2026-08-19T12:00:00Z');

describe('выдержка между повторами', () => {
  it('первая попытка идёт без задержки', () => {
    expect(backoffMs(0)).toBe(0);
  });

  it('задержка растёт по лестнице', () => {
    expect(backoffMs(1)).toBe(1 * MINUTE);
    expect(backoffMs(2)).toBe(5 * MINUTE);
    expect(backoffMs(3)).toBe(15 * MINUTE);
    expect(backoffMs(4)).toBe(60 * MINUTE);
  });

  it('дальше держится максимум шесть часов', () => {
    expect(backoffMs(5)).toBe(6 * 60 * MINUTE);
    expect(backoffMs(7)).toBe(6 * 60 * MINUTE);
  });
});

describe('время следующей попытки', () => {
  it('отправленный чек больше не отправляется', () => {
    expect(
      nextRetryAt({ soliqSyncedAt: T0, soliqAttempts: 1, soliqLastAttemptAt: T0 }),
    ).toBeNull();
  });

  it('новый чек можно отправлять сразу', () => {
    const at = nextRetryAt({ soliqSyncedAt: null, soliqAttempts: 0, soliqLastAttemptAt: null });
    expect(at).not.toBeNull();
    expect(isRetryDue({ soliqSyncedAt: null, soliqAttempts: 0, soliqLastAttemptAt: null }, T0)).toBe(
      true,
    );
  });

  it('после неудачи повтор ждёт выдержку', () => {
    const state = { soliqSyncedAt: null, soliqAttempts: 1, soliqLastAttemptAt: T0 };
    expect(nextRetryAt(state)?.toISOString()).toBe('2026-08-19T12:01:00.000Z');
    expect(isRetryDue(state, new Date('2026-08-19T12:00:30Z'))).toBe(false);
    expect(isRetryDue(state, new Date('2026-08-19T12:01:00Z'))).toBe(true);
  });

  it('исчерпав попытки, чек уходит в ручной разбор, а не в вечный повтор', () => {
    const state = {
      soliqSyncedAt: null,
      soliqAttempts: MAX_SOLIQ_ATTEMPTS,
      soliqLastAttemptAt: T0,
    };
    expect(nextRetryAt(state)).toBeNull();
    expect(isRetryDue(state, new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('состояние чека', () => {
  it('ушедший чек', () => {
    expect(receiptStatus({ soliqSyncedAt: T0, soliqAttempts: 1, soliqLastAttemptAt: T0 })).toBe(
      'sent',
    );
  });

  it('в очереди, попыток ещё не было', () => {
    expect(
      receiptStatus({ soliqSyncedAt: null, soliqAttempts: 0, soliqLastAttemptAt: null }),
    ).toBe('queued');
  });

  it('повторяется после неудачи', () => {
    expect(receiptStatus({ soliqSyncedAt: null, soliqAttempts: 2, soliqLastAttemptAt: T0 })).toBe(
      'retrying',
    );
  });

  it('застрял и требует разбора', () => {
    expect(
      receiptStatus({
        soliqSyncedAt: null,
        soliqAttempts: MAX_SOLIQ_ATTEMPTS,
        soliqLastAttemptAt: T0,
      }),
    ).toBe('stuck');
  });
});

describe('запись ошибки в журнал', () => {
  it('ошибка провайдера сворачивается в одну строку', () => {
    const e = new SoliqError('PROVIDER_UNAVAILABLE', 'Солик\n  не отвечает');
    expect(shortError(e)).toBe('SoliqError: Солик не отвечает');
  });

  it('строка обрезается по лимиту', () => {
    expect(shortError(new Error('x'.repeat(500))).length).toBeLessThanOrEqual(200);
  });

  it('не-ошибка тоже записывается', () => {
    expect(shortError('таймаут')).toBe('таймаут');
  });
});
