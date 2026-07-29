// Absolute sanity ceiling for a single order's volume (liters). Per-car limits
// (tank capacity, monthly limit) are enforced separately and are always stricter.
export const FULL_TANK_MAX_LITERS = 300;

export const ORDER_VOLUMES = [10, 15, 20, 25, 30, 40] as const;

export const APP_NAME = 'Benzeen';

// --- B2C fuel delivery (M2) ---
// Minimum liters for a consumer fuel order (enforced client- and server-side).
export const B2C_MIN_ORDER_LITERS = 30;
// Volume presets shown in the client order flow.
export const B2C_ORDER_VOLUMES = [30, 40, 50, 60] as const;
// Geo-dispatch tuning: how fresh a courier's location must be to be eligible,
// and how many nearest couriers get the initial offer.
export const COURIER_LOCATION_MAX_AGE_MS = 5 * 60 * 1000; // 5 min
export const DISPATCH_NEAREST_COUNT = 3;
// A RECEIVED B2C order unassigned longer than this is broadcast to all couriers.
export const DISPATCH_STALE_AFTER_MS = 2 * 60 * 1000; // 2 min
