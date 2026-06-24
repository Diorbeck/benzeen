// Absolute sanity ceiling for a single order's volume (liters). Per-car limits
// (tank capacity, monthly limit) are enforced separately and are always stricter.
export const FULL_TANK_MAX_LITERS = 300;

export const ORDER_VOLUMES = [10, 15, 20, 25, 30, 40] as const;

export const APP_NAME = 'Benzeen';
