// Client helpers for the referral link (M5). The code from /?ref=CODE is stored
// locally and attached to the sign-in call; the server binds it only for a
// brand-new user (self/unknown ignored).

const KEY = 'benzeen.ref';

export function captureRefFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r) localStorage.setItem(KEY, r.trim().toUpperCase().slice(0, 16));
  } catch {
    /* storage disabled — ignore */
  }
}

export function getStoredRef(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function clearStoredRef(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
