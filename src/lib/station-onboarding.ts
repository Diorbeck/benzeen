import { randomBytes } from "crypto";
import {
  DISPENSER_DAILY_RATE_UZS,
  STATION_FUEL_TYPES,
  TANK_DAILY_RATE_UZS,
  isStationFuelType,
  type StationFuelType,
} from "./stations";

// Модуль 6/7 ТЗ v2: подключение новой АЗС к Benzeen. Онбординг — это не просто
// строка в таблице: без резервуара с датчиком объект бесполезен (датчики —
// ядро продукта), поэтому хотя бы один резервуар обязателен, а колонки
// добавляются по желанию АЗС.
//
// Проверка входа живёт здесь, а не в маршруте: те же правила нужны и форме в
// админке, и тестам, а маршрут остаётся тонким.

/** Границы Узбекистана с запасом. Точка вне них — почти всегда описка в координатах. */
export const UZ_LAT_RANGE = [37.0, 46.0] as const;
export const UZ_LNG_RANGE = [55.0, 74.0] as const;

export const MAX_TANKS_PER_STATION = 20;
export const MAX_DISPENSERS_PER_STATION = 20;
export const MIN_TANK_CAPACITY_L = 500;
export const MAX_TANK_CAPACITY_L = 200_000;
/** Дней в месяце для оценки счёта на форме подключения. */
export const BILLING_DAYS_PER_MONTH = 30;

export type OnboardingTank = {
  label: string;
  fuelType: StationFuelType;
  capacityL: number;
  minLevelL: number | null;
  sensorSerial: string | null;
};

export type OnboardingDispenser = {
  number: number;
  fuelTypes: StationFuelType[];
  /** Колонка с идентификацией клиента тарифицируется отдельно. */
  billed: boolean;
};

export type OnboardingInput = {
  name: string;
  brand: string | null;
  address: string;
  region: string | null;
  tin: string | null;
  lat: number;
  lng: number;
  tanks: OnboardingTank[];
  dispensers: OnboardingDispenser[];
};

/** Код ошибки + путь до поля, чтобы форма подсветила именно его. */
export type OnboardingError = { field: string; code: string };

export type OnboardingParseResult =
  | { ok: true; value: OnboardingInput }
  | { ok: false; errors: OnboardingError[] };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalStr(value: unknown): string | null {
  const s = str(value);
  return s.length > 0 ? s : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    // Форма присылает числа строками, и запятая в дробной части — норма для
    // локали: «41,31» должно читаться как координата, а не как ошибка.
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Ключ пограничного контроллера АЗС. Показывается администратору один раз: в
 * базе лежит только хеш, восстановить ключ нельзя — можно лишь выдать новый.
 */
export function generateControllerKey(): string {
  return `bz_ctrl_${randomBytes(16).toString("hex")}`;
}

/** Суточная стоимость подписки объекта: резервуары обязательны, колонки — опция. */
export function onboardingDailyCostUzs(input: {
  tanks: readonly unknown[];
  dispensers: readonly { billed: boolean }[];
}): number {
  const billedDispensers = input.dispensers.filter((d) => d.billed).length;
  return (
    input.tanks.length * TANK_DAILY_RATE_UZS +
    billedDispensers * DISPENSER_DAILY_RATE_UZS
  );
}

/** Оценка счёта за месяц: счёт выставляется один раз в начале месяца. */
export function onboardingMonthlyEstimateUzs(input: {
  tanks: readonly unknown[];
  dispensers: readonly { billed: boolean }[];
}): number {
  return onboardingDailyCostUzs(input) * BILLING_DAYS_PER_MONTH;
}

function parseTank(
  raw: unknown,
  index: number,
  errors: OnboardingError[],
): OnboardingTank | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const label = str(row.label);
  const fuelType = str(row.fuelType);
  const capacityL = num(row.capacityL);
  const minLevelL = num(row.minLevelL);
  const base = `tanks.${index}`;

  if (label.length < 1 || label.length > 60)
    errors.push({ field: `${base}.label`, code: "label" });
  if (!isStationFuelType(fuelType))
    errors.push({ field: `${base}.fuelType`, code: "fuelType" });
  if (
    capacityL === null ||
    capacityL < MIN_TANK_CAPACITY_L ||
    capacityL > MAX_TANK_CAPACITY_L ||
    !Number.isInteger(capacityL)
  ) {
    errors.push({ field: `${base}.capacityL`, code: "capacity" });
  }
  // Критический порог не может быть выше объёма резервуара: иначе алерт горит
  // всегда и его перестают читать.
  if (
    minLevelL !== null &&
    (minLevelL < 0 || (capacityL !== null && minLevelL >= capacityL))
  ) {
    errors.push({ field: `${base}.minLevelL`, code: "minLevel" });
  }
  if (!isStationFuelType(fuelType) || capacityL === null) return null;

  return {
    label,
    fuelType,
    capacityL,
    minLevelL: minLevelL === null ? null : Math.round(minLevelL),
    sensorSerial: optionalStr(row.sensorSerial),
  };
}

function parseDispenser(
  raw: unknown,
  index: number,
  errors: OnboardingError[],
): OnboardingDispenser | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const number = num(row.number);
  const base = `dispensers.${index}`;
  const rawFuels = Array.isArray(row.fuelTypes) ? row.fuelTypes : [];
  const fuelTypes = rawFuels.map(str).filter(isStationFuelType);

  if (
    number === null ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > 99
  ) {
    errors.push({ field: `${base}.number`, code: "number" });
  }
  if (fuelTypes.length === 0)
    errors.push({ field: `${base}.fuelTypes`, code: "fuelTypes" });
  if (number === null || fuelTypes.length === 0) return null;

  return { number, fuelTypes, billed: row.billed === true };
}

/**
 * Разбор и проверка формы подключения АЗС.
 *
 * Возвращает либо готовый к записи объект, либо все ошибки сразу: заполнять
 * форму по одной ошибке за раз — это отдельный вид пытки для владельца АЗС.
 */
export function parseOnboardingInput(raw: unknown): OnboardingParseResult {
  const body = (raw ?? {}) as Record<string, unknown>;
  const errors: OnboardingError[] = [];

  const name = str(body.name);
  const address = str(body.address);
  const tin = optionalStr(body.tin);
  const lat = num(body.lat);
  const lng = num(body.lng);

  if (name.length < 2 || name.length > 120)
    errors.push({ field: "name", code: "name" });
  if (address.length < 5 || address.length > 200)
    errors.push({ field: "address", code: "address" });
  // ИНН необязателен: подключение объекта не должно ждать бумажную часть.
  if (tin !== null && !/^\d{9}$/.test(tin))
    errors.push({ field: "tin", code: "tin" });
  if (lat === null || lat < UZ_LAT_RANGE[0] || lat > UZ_LAT_RANGE[1]) {
    errors.push({ field: "lat", code: "lat" });
  }
  if (lng === null || lng < UZ_LNG_RANGE[0] || lng > UZ_LNG_RANGE[1]) {
    errors.push({ field: "lng", code: "lng" });
  }

  const rawTanks = Array.isArray(body.tanks) ? body.tanks : [];
  if (rawTanks.length < 1)
    errors.push({ field: "tanks", code: "tanksRequired" });
  if (rawTanks.length > MAX_TANKS_PER_STATION)
    errors.push({ field: "tanks", code: "tanksMax" });
  const tanks = rawTanks
    .slice(0, MAX_TANKS_PER_STATION)
    .map((row, i) => parseTank(row, i, errors))
    .filter((t): t is OnboardingTank => t !== null);

  const serials = tanks
    .map((t) => t.sensorSerial)
    .filter((s): s is string => s !== null);
  if (new Set(serials).size !== serials.length) {
    errors.push({ field: "tanks", code: "sensorDuplicate" });
  }

  const rawDispensers = Array.isArray(body.dispensers) ? body.dispensers : [];
  if (rawDispensers.length > MAX_DISPENSERS_PER_STATION) {
    errors.push({ field: "dispensers", code: "dispensersMax" });
  }
  const dispensers = rawDispensers
    .slice(0, MAX_DISPENSERS_PER_STATION)
    .map((row, i) => parseDispenser(row, i, errors))
    .filter((d): d is OnboardingDispenser => d !== null);

  const numbers = dispensers.map((d) => d.number);
  if (new Set(numbers).size !== numbers.length) {
    errors.push({ field: "dispensers", code: "numberDuplicate" });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      brand: optionalStr(body.brand),
      address,
      region: optionalStr(body.region),
      tin,
      lat: lat as number,
      lng: lng as number,
      tanks,
      dispensers,
    },
  };
}

/** Пустая заготовка резервуара для формы. */
export function emptyTankDraft(): {
  label: string;
  fuelType: StationFuelType;
  capacityL: string;
  minLevelL: string;
  sensorSerial: string;
} {
  return {
    label: "",
    fuelType: STATION_FUEL_TYPES[0],
    capacityL: "",
    minLevelL: "",
    sensorSerial: "",
  };
}
