import { describe, it, expect } from 'vitest';
import { pickNearestBeacon, BLE_MIN_RSSI, BLE_CONFIDENT_MARGIN_DB } from './ble-proximity';

describe('подбор колонки по BLE-маячкам', () => {
  it('без измерений колонку не выбирает', () => {
    expect(pickNearestBeacon([])).toBeNull();
  });

  it('берёт самый сильный сигнал', () => {
    const pick = pickNearestBeacon([
      { beaconId: 'b-1', rssi: -70 },
      { beaconId: 'b-2', rssi: -52 },
      { beaconId: 'b-3', rssi: -66 },
    ]);
    expect(pick?.beaconId).toBe('b-2');
    expect(pick?.rssi).toBe(-52);
  });

  it('игнорирует маячки слабее порога', () => {
    const pick = pickNearestBeacon([
      { beaconId: 'far', rssi: BLE_MIN_RSSI - 1 },
      { beaconId: 'near', rssi: -80 },
    ]);
    expect(pick?.beaconId).toBe('near');
    expect(pick?.marginDb).toBeNull();
  });

  it('все сигналы слабее порога — выбора нет', () => {
    expect(pickNearestBeacon([{ beaconId: 'far', rssi: -95 }])).toBeNull();
  });

  it('одинаково слышные колонки не дают уверенного выбора', () => {
    const pick = pickNearestBeacon([
      { beaconId: 'b-1', rssi: -58 },
      { beaconId: 'b-2', rssi: -56 },
    ]);
    expect(pick?.beaconId).toBe('b-2');
    expect(pick?.confident).toBe(false);
    expect(pick?.marginDb).toBe(2);
  });

  it('явный отрыв по сигналу — выбор уверенный', () => {
    const pick = pickNearestBeacon([
      { beaconId: 'b-1', rssi: -48 },
      { beaconId: 'b-2', rssi: -48 - BLE_CONFIDENT_MARGIN_DB },
    ]);
    expect(pick?.beaconId).toBe('b-1');
    expect(pick?.confident).toBe(true);
  });

  it('единственный маячок считается уверенным выбором', () => {
    const pick = pickNearestBeacon([{ beaconId: 'b-1', rssi: -70 }]);
    expect(pick?.confident).toBe(true);
  });

  it('дубли одного маячка не подменяют отрыв от соседа', () => {
    const pick = pickNearestBeacon([
      { beaconId: 'b-1', rssi: -60 },
      { beaconId: 'b-1', rssi: -50 },
      { beaconId: 'b-2', rssi: -75 },
    ]);
    expect(pick?.beaconId).toBe('b-1');
    expect(pick?.rssi).toBe(-50);
    expect(pick?.marginDb).toBe(25);
  });

  it('мусорные измерения отбрасываются', () => {
    const pick = pickNearestBeacon([
      { beaconId: '', rssi: -40 },
      { beaconId: 'b-1', rssi: Number.NaN },
      { beaconId: 'b-2', rssi: -70 },
    ]);
    expect(pick?.beaconId).toBe('b-2');
  });
});
