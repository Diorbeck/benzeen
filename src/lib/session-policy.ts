// Per-role session lifetime (seconds).
//
// Clients get a long-lived, rolling login so a returning user lands straight in
// Кабинет 2.0 / the "repeat last order" flow without re-authing over SMS every
// month. Staff (driver/courier/manager/admin) keep the shorter default — their
// behaviour is intentionally unchanged.
//
// With the JWT session strategy the session cookie lives for the *longest*
// maxAge (clients), but each token's real expiry is stamped per-role in
// `jwt.encode` (see auth.ts), so a staff token still expires after 30 days.

export const CLIENT_SESSION_MAX_AGE = 180 * 24 * 60 * 60; // 180 days
export const STAFF_SESSION_MAX_AGE = 30 * 24 * 60 * 60; //  30 days (unchanged)
export const SESSION_UPDATE_AGE = 24 * 60 * 60; //           roll (re-issue) at most daily

/** Token lifetime for a given role. Unknown/absent role → staff (shorter, safer). */
export function sessionMaxAgeSeconds(role: string | null | undefined): number {
  return role === 'CLIENT' ? CLIENT_SESSION_MAX_AGE : STAFF_SESSION_MAX_AGE;
}
