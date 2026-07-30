// ETA estimation (M3). v1 is a pure straight-line heuristic (haversine ÷ average
// city speed) with no external API. Kept behind an interface so it can later be
// swapped for real routing (e.g. Yandex Maps) without touching call sites.

import { haversineKm } from './geo';

export type Point = { lat: number; lng: number };

export interface EtaProvider {
  /** Estimated minutes to travel from → to, or null if not meaningful. */
  estimateMinutes(from: Point, to: Point): number | null;
}

// Average city driving speed used for the v1 straight-line estimate.
export const AVERAGE_SPEED_KMH = 25;
// Above this the estimate is too rough/far to be useful — callers hide it.
export const MAX_ETA_MINUTES = 90;

export const haversineEtaProvider: EtaProvider = {
  estimateMinutes(from, to) {
    const km = haversineKm(from, to);
    if (!Number.isFinite(km)) return null;
    const minutes = Math.ceil((km / AVERAGE_SPEED_KMH) * 60);
    // A courier essentially on-site still reads as "≈ 1 мин", never 0.
    return Math.max(1, minutes);
  },
};

/** The active ETA provider. Swap this to change the estimation backend. */
export const etaProvider: EtaProvider = haversineEtaProvider;
