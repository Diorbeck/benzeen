# Benzeen B2C — Design Audit (design-pass)

Frontend-only pass. No changes to `prisma/schema.prisma`, `/api/*`, auth, or
payment/money logic. Backend needs are captured as TODOs in `APP_HANDOFF.md`.

## Current state (before this pass)

The B2C surface exists (M1–M3) and works, but reads as an unfinished internal
tool, not a consumer product:

- **Home** (`components/b2c/landing.tsx`): two big generic cards («Бензин»/«Пропан»)
  with the vague CTA «Открыть». No value proposition, no "how it works", no
  proof of the real facts (24/7, all-Tashkent, price like a station, free
  delivery). A visitor can't tell in 5s that Benzeen brings fuel to your car.
- **Order flow** (`components/b2c/fuel-order-flow.tsx`): one long scroll that
  looks like an admin form — plain inputs, uppercase section labels, a single
  submit. Requires login *before* the flow (guests are bounced to login), which
  kills conversion. No sticky price summary on desktop, no per-step structure,
  disabled submit with no explanation.
- **Map**: MapLibre+OSM is wired behind a provider abstraction, but tiles don't
  render in prod — the security headers/CSP don't explicitly allow the OSM tile
  host and the worker, so the map shows blank.
- **Header**: not session-aware in the B2C shell — always shows «Войти», even
  for a logged-in client or staff.
- **Design system**: Tailwind theme has a blue scale + petrol/amber, but usage
  is inconsistent — every icon in a blue rounded square, oversized radii,
  ad-hoc spacing, no shared tokens for motion/shadow/z-index/container.
- **Copy**: functional but terse; no brand voice, some English/Uzbek mixed.
- **Pricing**: computed inline in the component (`price * liters`); no pure,
  tested function; no locale-aware liters pluralization.
- **Analytics**: none.

## Constraints (hard)

- Frontend only. Prices only from `/api/prices` (`Price`), never hardcoded.
- Only owner-confirmed facts in prod UI (see `PRODUCT_COPY.md`): 24/7, all
  Tashkent, price as at the station, free delivery, card-to-courier (terminal/QR).
  **No online-payment promise** in UI until Payme keys exist. No fake numbers,
  reviews, partners, licenses, zones.
- All strings via next-intl in uz/ru/en; verify lengths on all three.
- Roles incl. `PROPANE_OPERATOR` exist; B2B stays behind the flag and is never
  shown in B2C UI.

## Keep

- Provider-abstracted map (`components/map/provider.ts`), MapLibre+OSM.
- Server contracts: `POST /api/orders/client`, `/api/auth/client/*`, tracking
  API, order status lifecycle `RECEIVED → COURIER_ASSIGNED → IN_DELIVERY →
  DELIVERED (+ CANCELLED)`, M3 live tracking + ETA.
- Feature-flag gating of B2B.

## Rework

- New design tokens (color/type/spacing/radius/shadow/motion/z/container) and a
  single icon language.
- Home: value-first, mobile-first, hero built from real UI (styled map + route
  + order card), 3 real steps, real advantages, FAQ, footer.
- Order flow: app-like, stepped, sticky price summary (desktop) / fixed bottom
  CTA (mobile); **guest builds the whole order, logs in inline via SMS only at
  "Заказать"**; local draft with resume-after-reload.
- Header: session-aware (CLIENT → Кабинет, staff → dashboard, guest → Войти + CTA).
- Pricing extracted to a pure, tested function; locale-aware UZS + liters.
- CSP/security headers fixed so OSM tiles + worker load.
- Analytics abstraction + product events; localized SEO metadata.

## Plan / order

1. Tokens (`tailwind.config.ts`, `globals.css`) + `siteConfig`.
2. Concrete fixes: CSP (map), session-aware header.
3. Pure libs + tests: `pricing.ts`, `format.ts`, `analytics.ts`, order-draft.
4. Pages: Home → `/benzin` (guest draft + inline login) → `/propan` skeleton →
   `/account` + `client-login` restyle.
5. Copy (`PRODUCT_COPY.md`), handoff (`APP_HANDOFF.md`), SEO, i18n, tests.

## Known follow-ups (TODO, not in this pass)

- OSM public tiles have a usage policy; if prod tiles are throttled, move to a
  proper tile provider/self-host (keep the provider abstraction). Not a new API
  in this pass.
- Online payment UI (Payme) — gated until keys exist (backend done in M2/PR-B).
- Propane slots/booking — milestone M4.
