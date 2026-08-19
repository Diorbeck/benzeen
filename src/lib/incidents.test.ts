import { describe, expect, it } from 'vitest';
import { buildIncidents, countByKind, humanAge, INCIDENT_SEVERITY } from './incidents';

const NOW = new Date('2026-08-19T12:00:00Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60000);

const empty = {
  manualReview: [],
  stuckReceipts: [],
  offlineStations: [],
  staleTanks: [],
};

describe('давность в человеческом виде', () => {
  it('минуты', () => expect(humanAge(ago(7), NOW)).toBe('7 мин'));
  it('часы', () => expect(humanAge(ago(200), NOW)).toBe('3 ч'));
  it('сутки', () => expect(humanAge(ago(60 * 30), NOW)).toBe('1 сут'));
  it('без даты', () => expect(humanAge(null, NOW)).toBe('—'));
});

describe('сборка инцидентов', () => {
  it('пустой вход даёт пустой борд', () => {
    expect(buildIncidents(empty, NOW)).toEqual([]);
  });

  it('деньги клиента и налоговая идут выше связи и датчиков', () => {
    const items = buildIncidents(
      {
        ...empty,
        offlineStations: [{ id: 's2', name: 'АЗС 2', lastSeenAt: ago(90) }],
        manualReview: [
          {
            id: 'f1',
            stationId: 's1',
            stationName: 'АЗС 1',
            startedAt: ago(10),
            holdAmountUzs: 200000,
            litersDispensed: 12.5,
          },
        ],
      },
      NOW,
    );
    expect(items.map((i) => i.kind)).toEqual(['MANUAL_REVIEW', 'STATION_OFFLINE']);
    expect(items[0].severity).toBe('high');
    expect(items[0].detail).toContain('12.50 л');
  });

  it('внутри одной тяжести старое выше свежего', () => {
    const items = buildIncidents(
      {
        ...empty,
        stuckReceipts: [
          {
            id: 'r-new',
            stationId: 's1',
            stationName: 'АЗС 1',
            startedAt: ago(5),
            endedAt: ago(5),
            amountUzs: 100000,
            soliqLastError: null,
          },
          {
            id: 'r-old',
            stationId: 's1',
            stationName: 'АЗС 1',
            startedAt: ago(600),
            endedAt: ago(600),
            amountUzs: 100000,
            soliqLastError: 'SoliqError: недоступен',
          },
        ],
      },
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['sq-r-old', 'sq-r-new']);
    expect(items[0].error).toBe('SoliqError: недоступен');
  });

  it('молчащий датчик попадает на борд с названием резервуара', () => {
    const [item] = buildIncidents(
      {
        ...empty,
        staleTanks: [
          {
            id: 't1',
            label: 'Р-2',
            stationId: 's1',
            stationName: 'АЗС 1',
            lastReadingAt: ago(45),
          },
        ],
      },
      NOW,
    );
    expect(item.kind).toBe('TANK_STALE');
    expect(item.detail).toBe('Р-2 · замер 45 мин назад');
    expect(INCIDENT_SEVERITY.TANK_STALE).toBe('medium');
  });

  it('объект без единой связи не роняет сборку', () => {
    const [item] = buildIncidents(
      { ...empty, offlineStations: [{ id: 's9', name: 'АЗС 9', lastSeenAt: null }] },
      NOW,
    );
    expect(item.detail).toBe('нет связи —');
  });
});

describe('счётчики борда', () => {
  it('считают по видам', () => {
    const items = buildIncidents(
      {
        ...empty,
        offlineStations: [
          { id: 'a', name: 'A', lastSeenAt: ago(10) },
          { id: 'b', name: 'B', lastSeenAt: ago(20) },
        ],
        staleTanks: [
          { id: 't', label: 'Р-1', stationId: 'a', stationName: 'A', lastReadingAt: ago(30) },
        ],
      },
      NOW,
    );
    expect(countByKind(items)).toEqual({
      MANUAL_REVIEW: 0,
      SOLIQ_STUCK: 0,
      STATION_OFFLINE: 2,
      TANK_STALE: 1,
    });
  });
});
