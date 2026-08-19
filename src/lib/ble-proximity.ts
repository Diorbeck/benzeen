// Модуль 3 ТЗ v2, уровень «BLE-маячок на колонке».
//
// Телефон видит сразу несколько маячков: соседние колонки на той же АЗС стоят в
// пяти метрах друг от друга. Решение о том, у какой колонки стоит клиент,
// принимается здесь, в чистой функции, а не в обработчике запроса — так его
// можно проверить тестами и повторить в мобильном приложении один в один.
//
// Правила осознанно консервативные: лучше показать «выберите колонку вручную»,
// чем предложить подтвердить чужую заправку.

/** Одно измерение силы сигнала маячка телефоном. */
export type BeaconReading = {
  beaconId: string;
  /** RSSI в dBm: около -40 — вплотную, -100 — на пределе слышимости. */
  rssi: number;
};

/** Слабее этого сигнала маячок игнорируется: клиент явно не у этой колонки. */
export const BLE_MIN_RSSI = -85;

/**
 * Насколько сильнейший сигнал должен опережать следующий, чтобы выбор считался
 * уверенным. Разница меньше — колонки для телефона неразличимы, и подтверждать
 * автоматически нельзя.
 */
export const BLE_CONFIDENT_MARGIN_DB = 6;

export type BeaconPick = {
  beaconId: string;
  rssi: number;
  /** true — сигнал заметно сильнее остальных, можно предлагать подтверждение. */
  confident: boolean;
  /** Отрыв от следующего маячка в dB; null — других маячков не было. */
  marginDb: number | null;
};

/**
 * Выбирает маячок, у которого стоит клиент. null — ни один маячок не подходит
 * (пусто, все слабее порога или некорректные значения).
 */
export function pickNearestBeacon(readings: readonly BeaconReading[]): BeaconPick | null {
  // Один и тот же маячок телефон отдаёт несколькими измерениями за скан —
  // берём самое сильное по каждому, иначе дубли исказят отрыв от соседа.
  const strongest = new Map<string, number>();
  for (const r of readings) {
    if (!r || typeof r.beaconId !== 'string' || r.beaconId.length === 0) continue;
    if (!Number.isFinite(r.rssi)) continue;
    if (r.rssi < BLE_MIN_RSSI) continue;
    const prev = strongest.get(r.beaconId);
    if (prev == null || r.rssi > prev) strongest.set(r.beaconId, r.rssi);
  }

  const sorted = [...strongest.entries()].sort((a, b) => b[1] - a[1]);
  const best = sorted[0];
  if (!best) return null;

  const next = sorted[1];
  const marginDb = next ? best[1] - next[1] : null;

  return {
    beaconId: best[0],
    rssi: best[1],
    confident: marginDb == null || marginDb >= BLE_CONFIDENT_MARGIN_DB,
    marginDb,
  };
}
