import { describe, expect, it } from 'vitest';
import { buildExportCsv, csvCell, exportFileName, type ExportSession } from './station-export';

const base: ExportSession = {
  id: 'ses-1',
  startedAt: new Date('2026-08-19T07:00:00.000Z'),
  endedAt: new Date('2026-08-19T07:04:30.000Z'),
  fuelType: 'AI_95',
  litersDispensed: 32.456,
  amountUzs: 390_000,
  priceUzs: 12_000,
  holdAmountUzs: 420_000,
  refundUzs: 30_000,
  acquirerRef: 'apex-tx-77',
  soliqSyncedAt: new Date('2026-08-19T07:05:00.000Z'),
  cashbackUzs: 3_900,
  clientId: 'user-1',
  station: { id: 'st-1', name: 'АЗС Юнусабад', tin: '301234567' },
  dispenser: { number: 3 },
};

describe('экспорт транзакций для налоговой и банка', () => {
  it('в выгрузке для Солик есть ИНН, литры и кешбек', () => {
    const csv = buildExportCsv('soliq', [base]);
    const [header, row] = csv.trim().split('\r\n');
    expect(header.split(',')).toContain('station_tin');
    expect(row).toContain('301234567');
    expect(row).toContain('32.46'); // литры округляются до сотых
    expect(row).toContain('3900');
    expect(row).toContain('2026-08-19T07:05:00Z');
  });

  it('в выгрузке для банка есть резерв, списание и возврат разницы', () => {
    const csv = buildExportCsv('acquiring', [base]);
    const row = csv.trim().split('\r\n')[1];
    expect(row).toContain('420000');
    expect(row).toContain('390000');
    expect(row).toContain('30000');
    expect(row).toContain('apex-tx-77');
  });

  it('возврат считается сам, если банк ещё не подтвердил его', () => {
    const csv = buildExportCsv('acquiring', [{ ...base, refundUzs: null }]);
    expect(csv.trim().split('\r\n')[1].split(',')[7]).toBe('30000');
  });

  it('переливов не бывает: при списании выше резерва возврат нулевой', () => {
    const csv = buildExportCsv('acquiring', [
      { ...base, refundUzs: null, amountUzs: 450_000 },
    ]);
    expect(csv.trim().split('\r\n')[1].split(',')[7]).toBe('0');
  });

  it('пустые поля не ломают строку', () => {
    const csv = buildExportCsv('soliq', [
      {
        ...base,
        litersDispensed: null,
        amountUzs: null,
        cashbackUzs: null,
        soliqSyncedAt: null,
        endedAt: null,
        station: { ...base.station, tin: null },
      },
    ]);
    const row = csv.trim().split('\r\n')[1];
    expect(row.startsWith('ses-1,st-1,АЗС Юнусабад,,3,AI_95,,12000,,,,')).toBe(true);
  });

  it('название с запятой и кавычками экранируется', () => {
    expect(csvCell('АЗС "Восток", трасса')).toBe('"АЗС ""Восток"", трасса"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12)).toBe('12');
  });

  it('только заголовок, если заправок за период нет', () => {
    const csv = buildExportCsv('soliq', []);
    expect(csv.trim().split('\r\n')).toHaveLength(1);
  });

  it('в имени файла виден период и получатель', () => {
    const name = exportFileName('acquiring', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-31T23:59:59Z'));
    expect(name).toBe('benzeen-acquiring-2026-08-01-2026-08-31.csv');
  });
});
