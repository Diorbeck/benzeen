// Инцидент-борд Benzeen/Apex — Модуль 7 ТЗ v2, этап 6 роадмапы.
//
// Смысл экрана простой: у платформы есть четыре вида поломок, каждая из которых
// стоит денег или доверия — деньги клиента, застрявшие в ручном разборе; чек,
// не ушедший в налоговую; объект, потерявший связь; резервуар, который молчит и
// потому показывает клиенту старые остатки. Все они должны лежать в одном
// списке, отсортированном по тому, что чинить первым, а не расползаться по
// разным страницам кабинета.

export type IncidentKind =
  /** Заправка, которую автоматика закрыть не смогла: сверка по логу колонки. */
  | "MANUAL_REVIEW"
  /** Чек, по которому попытки отправки в Солик исчерпаны. */
  | "SOLIQ_STUCK"
  /** Объект без связи: остатки на карте больше не соответствуют реальности. */
  | "STATION_OFFLINE"
  /** Резервуар без свежего замера: датчик молчит. */
  | "TANK_STALE";

/** high — есть деньги клиента или обязательство перед налоговой. */
export type IncidentSeverity = "high" | "medium";

export type Incident = {
  id: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  stationId: string;
  stationName: string;
  /** Момент, с которого длится проблема. */
  at: Date;
  /** Короткая цифра для строки: сумма, литры или давность. */
  detail?: string;
  /** Текст последней ошибки провайдера, если он есть. */
  error?: string;
};

export const INCIDENT_SEVERITY: Record<IncidentKind, IncidentSeverity> = {
  MANUAL_REVIEW: "high",
  SOLIQ_STUCK: "high",
  STATION_OFFLINE: "medium",
  TANK_STALE: "medium",
};

export type ManualReviewInput = {
  id: string;
  stationId: string;
  stationName: string;
  startedAt: Date;
  holdAmountUzs: number;
  litersDispensed: number | null;
};

export type StuckReceiptInput = {
  id: string;
  stationId: string;
  stationName: string;
  endedAt: Date | null;
  startedAt: Date;
  amountUzs: number | null;
  soliqLastError: string | null;
};

export type OfflineStationInput = {
  id: string;
  name: string;
  lastSeenAt: Date | null;
};

export type StaleTankInput = {
  id: string;
  label: string;
  stationId: string;
  stationName: string;
  lastReadingAt: Date | null;
};

export type IncidentInput = {
  manualReview: ManualReviewInput[];
  stuckReceipts: StuckReceiptInput[];
  offlineStations: OfflineStationInput[];
  staleTanks: StaleTankInput[];
};

/** Давность в человеческом виде: минуты до часа, дальше часы, дальше сутки. */
export function humanAge(from: Date | null, now: Date): string {
  if (!from) return "—";
  const ms = Math.max(0, now.getTime() - from.getTime());
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} сут`;
}

/**
 * Собирает единый список инцидентов. Сортировка: сначала тяжёлые, внутри —
 * самые старые сверху: инцидент, который висит дольше, дороже.
 */
export function buildIncidents(
  input: IncidentInput,
  now: Date = new Date(),
): Incident[] {
  const items: Incident[] = [];

  for (const s of input.manualReview) {
    items.push({
      id: `mr-${s.id}`,
      kind: "MANUAL_REVIEW",
      severity: INCIDENT_SEVERITY.MANUAL_REVIEW,
      stationId: s.stationId,
      stationName: s.stationName,
      at: s.startedAt,
      detail: `${(s.litersDispensed ?? 0).toFixed(2)} л · резерв ${s.holdAmountUzs.toLocaleString("ru-RU")} сум`,
    });
  }

  for (const r of input.stuckReceipts) {
    items.push({
      id: `sq-${r.id}`,
      kind: "SOLIQ_STUCK",
      severity: INCIDENT_SEVERITY.SOLIQ_STUCK,
      stationId: r.stationId,
      stationName: r.stationName,
      at: r.endedAt ?? r.startedAt,
      detail: `${(r.amountUzs ?? 0).toLocaleString("ru-RU")} сум`,
      error: r.soliqLastError ?? undefined,
    });
  }

  for (const st of input.offlineStations) {
    items.push({
      id: `off-${st.id}`,
      kind: "STATION_OFFLINE",
      severity: INCIDENT_SEVERITY.STATION_OFFLINE,
      stationId: st.id,
      stationName: st.name,
      at: st.lastSeenAt ?? new Date(0),
      detail: `нет связи ${humanAge(st.lastSeenAt, now)}`,
    });
  }

  for (const t of input.staleTanks) {
    items.push({
      id: `tank-${t.id}`,
      kind: "TANK_STALE",
      severity: INCIDENT_SEVERITY.TANK_STALE,
      stationId: t.stationId,
      stationName: t.stationName,
      at: t.lastReadingAt ?? new Date(0),
      detail: `${t.label} · замер ${humanAge(t.lastReadingAt, now)} назад`,
    });
  }

  const weight = (s: IncidentSeverity) => (s === "high" ? 0 : 1);
  return items.sort(
    (a, b) =>
      weight(a.severity) - weight(b.severity) ||
      a.at.getTime() - b.at.getTime(),
  );
}

/** Счётчики для шапки борда. */
export function countByKind(items: Incident[]): Record<IncidentKind, number> {
  const acc: Record<IncidentKind, number> = {
    MANUAL_REVIEW: 0,
    SOLIQ_STUCK: 0,
    STATION_OFFLINE: 0,
    TANK_STALE: 0,
  };
  for (const i of items) acc[i.kind] += 1;
  return acc;
}
