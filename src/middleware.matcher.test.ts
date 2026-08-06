import { describe, expect, it } from 'vitest';

import { config } from './middleware';

// The first matcher entry is the negative-lookahead that decides which paths the
// next-intl middleware runs on. Root-level metadata routes (opengraph-image,
// icon, ...) live at the app ROOT, not under /[locale], so the middleware must
// NOT run on them — otherwise it 308-redirects /opengraph-image -> /ru/opengraph-image
// which 404s and social crawlers get no card. See PR fixing the OG middleware matcher.
const matcher = config.matcher[0];
// Next.js applies the matcher against the full pathname; anchor it for the test.
const re = new RegExp(`^${matcher}$`);

describe('middleware matcher', () => {
  it('SKIPS root-level metadata routes (served at the root, no locale redirect)', () => {
    expect(re.test('/opengraph-image')).toBe(false);
    expect(re.test('/twitter-image')).toBe(false);
    expect(re.test('/icon')).toBe(false);
    expect(re.test('/apple-icon')).toBe(false);
  });

  it('still runs on normal locale-able page paths', () => {
    expect(re.test('/')).toBe(true);
    expect(re.test('/benzin')).toBe(true);
    expect(re.test('/account')).toBe(true);
    expect(re.test('/ru')).toBe(true);
  });

  it('still excludes infrastructure paths', () => {
    expect(re.test('/api/auth/session')).toBe(false);
    expect(re.test('/_next/static/chunk.js')).toBe(false);
    expect(re.test('/tg')).toBe(false);
    expect(re.test('/tg/app')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
  });
});
