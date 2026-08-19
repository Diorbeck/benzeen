import { DISPENSER_DAILY_RATE_UZS } from './stations';

// Модуль 6 ТЗ v2: владелец АЗС сам включает и выключает идентификацию клиента на
// конкретной колонке.
//
// MANUAL работает везде и без железа, поэтому выключение всегда разрешено и
// бесплатно. BLE требует, чтобы к колонке был привязан маячок: без beaconId
// приложение не сможет определить колонку, и клиент увидит «колонка не найдена»
// вместо заправки. CAMERA — распознавание номера, и до готовности юридической
// базы по персональным данным (раздел 5 ТЗ) её включает только Benzeen, поэтому
// решение владельца проходит через флаг платформы.

export type IdentificationMode = 'MANUAL' | 'BLE' | 'CAMERA';

export type SwitchContext = {
  from: IdentificationMode;
  to: IdentificationMode;
  /** К колонке привязан BLE-маячок. */
  hasBeacon: boolean;
  /** Модуль камер разрешён платформой (юридическая база готова). */
  cameraEnabled: boolean;
};

export type SwitchDecision =
  | { ok: true; billable: boolean }
  | { ok: false; reason: 'beaconRequired' | 'cameraNotAvailable' | 'unknownMode' };

const MODES: readonly IdentificationMode[] = ['MANUAL', 'BLE', 'CAMERA'];

export function isIdentificationMode(value: unknown): value is IdentificationMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

/** Тарифицируется ли колонка: платная только идентификация клиента. */
export function isBillableMode(mode: IdentificationMode): boolean {
  return mode !== 'MANUAL';
}

/** Ставка за колонку в сутки при выбранном режиме. */
export function identificationDailyRateUzs(mode: IdentificationMode): number {
  return isBillableMode(mode) ? DISPENSER_DAILY_RATE_UZS : 0;
}

export function decideSwitch(ctx: SwitchContext): SwitchDecision {
  if (!isIdentificationMode(ctx.to)) return { ok: false, reason: 'unknownMode' };
  if (ctx.to === 'BLE' && !ctx.hasBeacon) return { ok: false, reason: 'beaconRequired' };
  if (ctx.to === 'CAMERA' && !ctx.cameraEnabled) return { ok: false, reason: 'cameraNotAvailable' };
  return { ok: true, billable: isBillableMode(ctx.to) };
}

/**
 * Что делать с подпиской по колонке при смене режима.
 *
 * Смена BLE → CAMERA не трогает подписку: ставка та же, и открывать новую строку
 * значило бы дважды посчитать одни сутки.
 */
export type BillingEffect = 'open' | 'close' | 'keep';

export function billingEffect(from: IdentificationMode, to: IdentificationMode): BillingEffect {
  const wasBillable = isBillableMode(from);
  const willBill = isBillableMode(to);
  if (!wasBillable && willBill) return 'open';
  if (wasBillable && !willBill) return 'close';
  return 'keep';
}
