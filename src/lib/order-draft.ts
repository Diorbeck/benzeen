// Guest order draft (design-pass). A guest builds the whole order before login;
// we persist it locally so a reload (or the inline SMS login round-trip) never
// loses their progress. Storage is injectable so it's unit-testable in node.

export type DraftFuel = 'AI_92' | 'AI_95' | 'AI_100';

export interface OrderDraft {
  fuelType?: DraftFuel;
  volume?: number;
  isFullTank?: boolean;
  lat?: number;
  lng?: number;
  address?: string;
  clientCarId?: string;
  car?: { plate?: string; model?: string; tankCapacity?: number };
  updatedAt?: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'benzeen.orderDraft.v1';

function getStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** A draft is worth restoring only if it holds a real choice. */
export function isMeaningfulDraft(d: OrderDraft | null | undefined): boolean {
  if (!d) return false;
  return Boolean(
    d.fuelType || d.volume || d.isFullTank || d.address || (d.lat != null && d.lng != null) || d.car?.plate,
  );
}

export function loadDraft(storage: StorageLike | null = getStorage()): OrderDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderDraft;
    return isMeaningfulDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(
  draft: OrderDraft,
  now: number = Date.now(),
  storage: StorageLike | null = getStorage(),
): void {
  if (!storage) return;
  try {
    if (!isMeaningfulDraft(draft)) {
      storage.removeItem(KEY);
      return;
    }
    storage.setItem(KEY, JSON.stringify({ ...draft, updatedAt: now }));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function clearDraft(storage: StorageLike | null = getStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}
