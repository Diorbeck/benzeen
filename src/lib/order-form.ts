// Pure order-form logic (design-pass). Keeps "can I submit, and if not why" out
// of the component so it's testable and the disabled state can always explain
// itself with a reason (never a silent grey button).

import { B2C_MIN_ORDER_LITERS, B2C_ORDER_VOLUMES } from './constants';
import type { FuelType } from './pricing';

export const FUEL_TYPES: FuelType[] = ['AI_92', 'AI_95', 'AI_100'];
export const VOLUME_PRESETS = B2C_ORDER_VOLUMES;

export interface OrderFormState {
  point: { lat: number; lng: number } | null;
  hasExistingCar: boolean;
  newPlate: string;
  fuelType: FuelType;
  volume: number;
  isFullTank: boolean;
  knownTankCapacity: number | null;
}

/** Liters that will be charged/ordered (full tank uses the known capacity). */
export function resolveLiters(s: Pick<OrderFormState, 'isFullTank' | 'volume' | 'knownTankCapacity'>): number {
  if (s.isFullTank && s.knownTankCapacity) return s.knownTankCapacity;
  return Number.isFinite(s.volume) ? s.volume : 0;
}

// Why the order can't be submitted yet — mapped to a human message in the UI.
export type SubmitBlock = null | 'no_point' | 'no_car' | 'min_volume' | 'no_tank_capacity';

export function submitBlockReason(s: OrderFormState): SubmitBlock {
  if (!s.point) return 'no_point';
  if (!s.hasExistingCar && !s.newPlate.trim()) return 'no_car';
  if (s.isFullTank) return s.knownTankCapacity ? null : 'no_tank_capacity';
  if (!(s.volume >= B2C_MIN_ORDER_LITERS)) return 'min_volume';
  return null;
}

export function canSubmitOrder(s: OrderFormState): boolean {
  return submitBlockReason(s) === null;
}
