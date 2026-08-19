import { describe, expect, it } from 'vitest';
import {
  billingEffect,
  decideSwitch,
  identificationDailyRateUzs,
  isBillableMode,
  isIdentificationMode,
} from './dispenser-identification';

describe('режим идентификации', () => {
  it('распознаёт только известные режимы', () => {
    expect(isIdentificationMode('BLE')).toBe(true);
    expect(isIdentificationMode('FACE')).toBe(false);
    expect(isIdentificationMode(null)).toBe(false);
  });

  it('платная только идентификация клиента', () => {
    expect(isBillableMode('MANUAL')).toBe(false);
    expect(isBillableMode('BLE')).toBe(true);
    expect(isBillableMode('CAMERA')).toBe(true);
  });

  it('ставка за колонку — 10 000 сум в сутки, ручной выбор бесплатен', () => {
    expect(identificationDailyRateUzs('MANUAL')).toBe(0);
    expect(identificationDailyRateUzs('BLE')).toBe(10_000);
    expect(identificationDailyRateUzs('CAMERA')).toBe(10_000);
  });
});

describe('разрешение на смену режима', () => {
  it('выключение идентификации разрешено всегда', () => {
    expect(decideSwitch({ from: 'CAMERA', to: 'MANUAL', hasBeacon: false, cameraEnabled: false })).toEqual({
      ok: true,
      billable: false,
    });
  });

  it('BLE без привязанного маячка не включается', () => {
    expect(decideSwitch({ from: 'MANUAL', to: 'BLE', hasBeacon: false, cameraEnabled: true })).toEqual({
      ok: false,
      reason: 'beaconRequired',
    });
  });

  it('BLE с маячком включается и тарифицируется', () => {
    expect(decideSwitch({ from: 'MANUAL', to: 'BLE', hasBeacon: true, cameraEnabled: false })).toEqual({
      ok: true,
      billable: true,
    });
  });

  it('камера не включается, пока модуль не разрешён платформой', () => {
    expect(decideSwitch({ from: 'MANUAL', to: 'CAMERA', hasBeacon: true, cameraEnabled: false })).toEqual({
      ok: false,
      reason: 'cameraNotAvailable',
    });
  });

  it('камера включается, когда модуль разрешён', () => {
    expect(decideSwitch({ from: 'BLE', to: 'CAMERA', hasBeacon: true, cameraEnabled: true })).toEqual({
      ok: true,
      billable: true,
    });
  });

  it('неизвестный режим отклоняется', () => {
    const ctx = { from: 'MANUAL' as const, to: 'FACE', hasBeacon: true, cameraEnabled: true };
    expect(decideSwitch(ctx as never)).toEqual({ ok: false, reason: 'unknownMode' });
  });
});

describe('влияние смены режима на подписку', () => {
  it('включение идентификации открывает строку подписки', () => {
    expect(billingEffect('MANUAL', 'BLE')).toBe('open');
    expect(billingEffect('MANUAL', 'CAMERA')).toBe('open');
  });

  it('выключение закрывает строку', () => {
    expect(billingEffect('BLE', 'MANUAL')).toBe('close');
  });

  it('переход между платными режимами подписку не меняет', () => {
    expect(billingEffect('BLE', 'CAMERA')).toBe('keep');
    expect(billingEffect('CAMERA', 'BLE')).toBe('keep');
  });

  it('повторный выбор того же режима ничего не меняет', () => {
    expect(billingEffect('MANUAL', 'MANUAL')).toBe('keep');
    expect(billingEffect('BLE', 'BLE')).toBe('keep');
  });
});
