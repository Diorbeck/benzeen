import { createHash, timingSafeEqual } from 'crypto';
import type { FuelType } from '@prisma/client';

// --- v2: стационарные АЗС ---

// Сколько АЗС считается живой без признака жизни от контроллера. Датчик по ТЗ
// шлёт показания часто; пять минут тишины — это уже потеря связи с объектом, и
// клиенту честнее показать «офлайн», чем остаток, которому нельзя верить.
export const STATION_OFFLINE_AFTER_MS = 5 * 60 * 1000;

// Показание старше этого срока не показывается клиенту как остаток: даже если
// сама АЗС на связи, устаревшее по этому резервуару значение — не остаток.
export const TANK_READING_STALE_AFTER_MS = 15 * 60 * 1000;

// Тариф подписки АЗС (сум/сутки). Это не комиссия с оборота: цена не зависит от
// того, сколько топлива продано.
export const TANK_DAILY_RATE_UZS = 25_000;
export const DISPENSER_DAILY_RATE_UZS = 10_000;

// Виды топлива, которые бывают на стационарной АЗС. Пропан здесь намеренно
// отсутствует: это отдельный бизнес с отдельными точками (PropanePoint).
export const STATION_FUEL_TYPES = ['AI_92', 'AI_95', 'AI_98', 'AI_100', 'DIESEL'] as const;

export type StationFuelType = (typeof STATION_FUEL_TYPES)[number];

export function isStationFuelType(value: string): value is StationFuelType {
  return (STATION_FUEL_TYPES as readonly string[]).includes(value);
}

// Онлайн считается от времени последнего признака жизни, а не от поля в базе:
// поле пришлось бы переписывать каждую минуту фоновой задачей, и любой её сбой
// выглядел бы как массовое падение всех АЗС страны.
export function isStationOnline(lastSeenAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastSeenAt) return false;
  return now.getTime() - lastSeenAt.getTime() <= STATION_OFFLINE_AFTER_MS;
}

export function isReadingFresh(lastReadingAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastReadingAt) return false;
  return now.getTime() - lastReadingAt.getTime() <= TANK_READING_STALE_AFTER_MS;
}

export type TankLike = {
  fuelType: FuelType;
  status: 'ACTIVE' | 'MAINTENANCE';
  capacityL: number;
  currentLevelL: number | null;
  lastReadingAt: Date | null;
};

export type FuelStock = {
  fuelType: FuelType;
  /** Сумма остатков по всем живым резервуарам этого вида, литры. */
  litersAvailable: number;
  capacityL: number;
  /** false — есть резервуар, но данные устарели: остаток показывать нельзя. */
  dataFresh: boolean;
  tanksCount: number;
};

// Клиенту важен не резервуар, а «есть ли здесь 95-й и сколько». Резервуаров
// одного вида на АЗС может быть несколько, поэтому остатки складываются.
// Резервуар на обслуживании исключается целиком: его топливо не продаётся.
export function aggregateStocks(tanks: readonly TankLike[], now: Date = new Date()): FuelStock[] {
  const byFuel = new Map<FuelType, FuelStock>();

  for (const tank of tanks) {
    if (tank.status === 'MAINTENANCE') continue;

    const entry =
      byFuel.get(tank.fuelType) ??
      ({
        fuelType: tank.fuelType,
        litersAvailable: 0,
        capacityL: 0,
        dataFresh: true,
        tanksCount: 0,
      } satisfies FuelStock);

    entry.tanksCount += 1;
    entry.capacityL += tank.capacityL;

    const fresh = isReadingFresh(tank.lastReadingAt, now) && tank.currentLevelL !== null;
    if (fresh) {
      entry.litersAvailable += Math.max(0, tank.currentLevelL as number);
    } else {
      // Один устаревший резервуар делает несвежей всю цифру по этому виду —
      // иначе клиент увидел бы заниженный остаток и решил, что топлива нет.
      entry.dataFresh = false;
    }

    byFuel.set(tank.fuelType, entry);
  }

  return [...byFuel.values()].sort(
    (a, b) => STATION_FUEL_TYPES.indexOf(a.fuelType as StationFuelType) - STATION_FUEL_TYPES.indexOf(b.fuelType as StationFuelType),
  );
}

// Расстояние по прямой, километры. Дорожная дистанция здесь не нужна: список
// АЗС сортируется по близости, и для порядка «какая ближе» прямой хватает.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// --- Ключ контроллера АЗС ---
//
// В базе лежит только хеш: дамп базы не должен давать право писать телеметрию
// от имени чужой АЗС. Соли нет намеренно — ключ генерируем мы, он длинный и
// случайный, а подбор по словарю к такому ключу неприменим.
export function hashControllerKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function verifyControllerKey(key: string, expectedHash: string | null | undefined): boolean {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashControllerKey(key), 'hex');
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, 'hex');
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  // Сравнение за постоянное время: обычное сравнение строк утекает информацию
  // о том, сколько символов ключа угадано.
  return timingSafeEqual(actual, expected);
}
