// Pure order-price calculation (design-pass). Kept separate + tested so the
// number the client sees can never drift from a component's inline math.
// Prices always come from the Price table via /api/prices — never hardcoded.

export type FuelType = 'AI_92' | 'AI_95' | 'AI_100';

/** Narrow a DB fuel value (which may be PROPANE, M4) to the gasoline union. */
export function asGasoline(fuel: string | null | undefined): FuelType | null {
  return fuel === 'AI_92' || fuel === 'AI_95' || fuel === 'AI_100' ? fuel : null;
}

export interface OrderPriceInput {
  /** UZS per liter, snapshot from the Price table. */
  pricePerLiter: number;
  /** Ordered liters (for "full tank" pass the known tank capacity). */
  volume: number;
}

export interface OrderPrice {
  pricePerLiter: number;
  liters: number;
  /** UZS total = pricePerLiter × liters. */
  total: number;
}

/** Computes the order total. Defensive: floors to whole liters/UZS, never negative. */
export function calcOrderPrice({ pricePerLiter, volume }: OrderPriceInput): OrderPrice {
  const ppl = Number.isFinite(pricePerLiter) ? Math.max(0, Math.floor(pricePerLiter)) : 0;
  const liters = Number.isFinite(volume) ? Math.max(0, Math.floor(volume)) : 0;
  return { pricePerLiter: ppl, liters, total: ppl * liters };
}
