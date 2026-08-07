// Anti-fraud FLAGS for the referral program (PR-C). These only HIGHLIGHT
// suspicious referrers/couriers for a human admin — they NEVER auto-block or
// touch the ledger. Pure functions so they are unit-tested in isolation.
import { haversineKm } from './geo';

// A referred friend's first delivered order, reduced to the signals we cross-check.
export type FirstOrderSignal = {
  clientId: string;
  lat: number | null;
  lng: number | null;
  plate: string | null;
  courierId: string | null;
  // ms between the courier taking the job and marking it delivered (fast-close signal).
  closeMs: number | null;
};

// Defaults per the TZ: ≥3 shared → flag; ~100 m address radius; <10 min close.
export const SHARE_MIN = 3;
export const ADDRESS_RADIUS_M = 100;
export const FAST_CLOSE_MS = 10 * 60 * 1000;

/** Largest group of points that all lie within `radiusM` of a common member. */
export function maxSharedWithin(
  points: { lat: number | null; lng: number | null }[],
  radiusM = ADDRESS_RADIUS_M,
): number {
  const pts = points.filter(
    (p): p is { lat: number; lng: number } => p.lat != null && p.lng != null,
  );
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    let count = 0;
    for (let j = 0; j < pts.length; j++) {
      const km = haversineKm(pts[i], pts[j]);
      if (km * 1000 <= radiusM) count++;
    }
    if (count > best) best = count;
  }
  return best;
}

/** Size of the largest identical, non-empty value group (e.g. same plate/courier). */
export function maxSharedValue(values: (string | null)[]): number {
  const counts = new Map<string, number>();
  let best = 0;
  for (const v of values) {
    if (!v) continue;
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > best) best = n;
  }
  return best;
}

export type ReferrerFlags = {
  sharedAddress: boolean;
  sharedPlate: boolean;
  sharedCourier: boolean;
  fastCourierCloses: boolean;
  any: boolean;
};

/**
 * Evaluate all referrer-level fraud signals over a referrer's referred-friend
 * first orders. Any single flag highlights the referrer for manual review.
 */
export function evaluateReferrerFlags(
  orders: FirstOrderSignal[],
  opts: { shareMin?: number; radiusM?: number; fastCloseMs?: number } = {},
): ReferrerFlags {
  const shareMin = opts.shareMin ?? SHARE_MIN;
  const radiusM = opts.radiusM ?? ADDRESS_RADIUS_M;
  const fastCloseMs = opts.fastCloseMs ?? FAST_CLOSE_MS;

  const sharedAddress = maxSharedWithin(orders, radiusM) >= shareMin;
  const sharedPlate = maxSharedValue(orders.map((o) => o.plate)) >= shareMin;
  const sharedCourier = maxSharedValue(orders.map((o) => o.courierId)) >= shareMin;
  const fastCourierCloses =
    orders.filter((o) => o.closeMs != null && o.closeMs < fastCloseMs).length >= shareMin;

  const any = sharedAddress || sharedPlate || sharedCourier || fastCourierCloses;
  return { sharedAddress, sharedPlate, sharedCourier, fastCourierCloses, any };
}

/** A courier's first-order close is anomalously fast (TAKE→DELIVERED under threshold). */
export function isFastClose(closeMs: number | null, thresholdMs = FAST_CLOSE_MS): boolean {
  return closeMs != null && closeMs >= 0 && closeMs < thresholdMs;
}
