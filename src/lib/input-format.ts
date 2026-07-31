// Light input formatting (design-pass). Non-blocking: we tidy input but never
// reject a value the user typed (Uzbek plates have several valid shapes).

/** Strip spaces/()- so a phone matches +998XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, '');
}

/**
 * Live-tidy an Uzbek plate: uppercase, keep letters/digits/spaces, collapse
 * runs of spaces. Does NOT enforce a template — non-standard plates pass through.
 */
export function formatPlate(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '');
}
