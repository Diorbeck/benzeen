// Модуль 7 ТЗ v2: экспорт данных по заправкам через Benzeen.
// Два получателя, два разных набора полей:
//   - налоговая (Солик) сверяет фискальные чеки: ИНН объекта, литры, сумма, НДС-часть
//     считается на их стороне, нам важно отдать факт транзакции и признак отправки;
//   - банк (Apex, эквайринг) сверяет платёжную часть: ссылка на транзакцию эквайринга,
//     сумма резерва и точного списания, возврат разницы.
// CSV, а не JSON: и Солик, и банк работают с выгрузками в таблицах.

export type ExportKind = 'soliq' | 'acquiring';

export type ExportSession = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  fuelType: string;
  litersDispensed: number | null;
  amountUzs: number | null;
  priceUzs: number;
  holdAmountUzs: number;
  acquirerRef: string | null;
  soliqSyncedAt: Date | null;
  refundUzs: number | null;
  cashbackUzs: number | null;
  clientId: string | null;
  station: { id: string; name: string; tin: string | null };
  dispenser: { number: number };
};

const SOLIQ_HEADER = [
  'session_id',
  'station_id',
  'station_name',
  'station_tin',
  'dispenser',
  'fuel_type',
  'liters',
  'price_uzs',
  'amount_uzs',
  'cashback_uzs',
  'sent_at',
  'ended_at',
] as const;

const ACQUIRING_HEADER = [
  'session_id',
  'station_id',
  'station_name',
  'dispenser',
  'fuel_type',
  'hold_uzs',
  'amount_uzs',
  'refund_uzs',
  'acquirer_ref',
  'client_id',
  'started_at',
  'ended_at',
] as const;

/** Дата в ISO без миллисекунд: и Солик, и банк принимают такой вид. */
function iso(date: Date | null): string {
  return date ? date.toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
}

/** Экранирование по RFC 4180: кавычки, запятые и переводы строк в названиях АЗС. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function soliqRow(s: ExportSession): (string | number | null)[] {
  return [
    s.id,
    s.station.id,
    s.station.name,
    s.station.tin,
    s.dispenser.number,
    s.fuelType,
    s.litersDispensed === null ? '' : round2(s.litersDispensed),
    s.priceUzs,
    s.amountUzs ?? '',
    s.cashbackUzs ?? '',
    iso(s.soliqSyncedAt),
    iso(s.endedAt),
  ];
}

function acquiringRow(s: ExportSession): (string | number | null)[] {
  // Возврат разницы: берём факт из базы, а если банк ещё не подтвердил возврат —
  // считаем ожидаемую разницу между резервом и точным списанием.
  const amount = s.amountUzs ?? 0;
  const refund = s.refundUzs ?? (s.holdAmountUzs > amount ? s.holdAmountUzs - amount : 0);
  return [
    s.id,
    s.station.id,
    s.station.name,
    s.dispenser.number,
    s.fuelType,
    s.holdAmountUzs,
    s.amountUzs ?? '',
    refund,
    s.acquirerRef,
    s.clientId,
    iso(s.startedAt),
    iso(s.endedAt),
  ];
}

export function buildExportCsv(kind: ExportKind, sessions: readonly ExportSession[]): string {
  const header = kind === 'soliq' ? SOLIQ_HEADER : ACQUIRING_HEADER;
  const rows = sessions.map((s) => (kind === 'soliq' ? soliqRow(s) : acquiringRow(s)));
  return [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n') + '\r\n';
}

/** Имя файла с периодом: чтобы выгрузки за разные месяцы не путались. */
export function exportFileName(kind: ExportKind, from: Date, to: Date): string {
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return `benzeen-${kind}-${d(from)}-${d(to)}.csv`;
}
