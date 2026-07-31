# Benzeen — Mobile App Handoff (RN/Expo)

Reference for a future React Native / Expo client. **No RN code and no monorepo
are created in this pass.** The web app is the source of truth for flows, states,
and API contracts; this maps them to app screens and lists backend TODOs.

## Roles

`SUPER_ADMIN · COMPANY_ADMIN · DRIVER · COURIER · DISPATCHER · CLIENT · PROPANE_OPERATOR`.
The consumer app is **CLIENT-only**. B2B roles stay behind the feature flag and
never appear in the B2C app. Courier/operator tooling is separate (Telegram today).

## Navigation map (CLIENT app)

```
Onboarding (language) ─┐
                       ▼
Home ──► Benzin order flow ──► SMS confirm (inline) ──► Order status (live)
  │                                                          │
  ├──► Propane nearby (M4)                                   ▼
  └──► Account ──► Order history ──► Order status        Account
```

- **Home** — value prop, service selector (Benzin primary, Propane secondary), how-it-works.
- **Benzin order** — steps: Vehicle → Fuel & volume → Address(map) → Summary.
  Guest builds the whole order; login (SMS) happens at "Order".
- **SMS confirm** — phone → 6-digit code (bottom sheet).
- **Order status** — live courier map + ETA, status stepper, details, receipt.
- **Account** — profile (phone, name), order history, saved cars/locations (M5), sign out.
- **Propane nearby** — map + points list (M4).

## Screen states (every data screen)

`loading` (skeleton) · `empty` (honest, no fake data) · `error` (+ retry) ·
`ready`. Disabled actions always show a reason. Respect reduced-motion.

## Order status schema (source of truth — do not change)

`RECEIVED → COURIER_ASSIGNED → IN_DELIVERY → DELIVERED` (+ `CANCELLED`).
Client-visible labels: Ищем курьера → Курьер найден → В пути → Доставлено.

## Data models (client-facing subset)

- **ClientCar** `{ id, plate, model?, tankCapacity? }`
- **Order** `{ id, fuelType (AI_92|AI_95|AI_100), volume, isFullTank, dispensedVolume?,
  pricePerLiter, totalAmount, lat, lng, address?, status, paymentMethod
  (COURIER_POS|PAYME|CLICK|UZUM), paymentStatus (NOT_REQUIRED|PENDING|PAID),
  createdAt, deliveredAt? }`
- **CourierLocation** (tracking) `{ lat, lng, updatedAt }` — exposed only while active + fresh.
- **PropanePoint** (M4) `{ id, name, lat, lng, pricePerLiter, status }`

## API contracts (existing — reuse from the app)

- `POST /api/auth/client/send-code` `{ phone:+998XXXXXXXXX }` → `{ ok }` | `{ error }`.
- NextAuth credentials `mode:'client'` — `identifier=phone, password=code` → CLIENT session.
- `GET  /api/prices` → `[{ fuelType, priceUzs }]`.
- `POST /api/orders/client` `{ fuelType, volume|isFullTank, lat, lng, address?,
  clientCarId|newCar, paymentMethod? }` → `{ id, status, checkoutUrl? }`.
  **Requires a CLIENT session** (unchanged).
- `GET  /api/orders/client/[id]` → order detail.
- `GET  /api/orders/client/[id]/tracking` → `{ status, courier:{lat,lng,updatedAt}|null }`.
- `PATCH /api/courier/orders/[id]` — courier only (not in the client app).

## Reusable logic already extracted (portable to RN)

- `src/lib/pricing.ts` — `calcOrderPrice` (pure).
- `src/lib/format.ts` — `formatMoney`, `formatLiters` (Intl).
- `src/lib/order-form.ts` — `submitBlockReason`, `resolveLiters`, presets.
- `src/lib/order-draft.ts` — draft persistence (swap storage → AsyncStorage).
- `src/lib/analytics.ts` — provider-agnostic events (register a native provider).
- `src/lib/eta.ts` — ETA behind `EtaProvider`.
- `src/components/map/provider.ts` — map provider abstraction (swap for a native map SDK).

## Components to port

Header (session-aware), StepCard, fuel/volume selectors, MapPicker → native map,
order Summary, InlineLogin sheet → native bottom sheet, OrderStatus (stepper +
live map), PropaneNearby.

## Backend TODOs surfaced by this pass (NOT implemented here)

- **Propane points API** for `/propan` (M4): `GET /api/propane/points` →
  `PropanePoint[]`; wire loading/error/empty already built in `PropaneNearby`.
- **Payme online payment UI** — enable once merchant keys exist (backend done, M2/PR-B).
- **Map tiles at scale** — OSM public tiles have a usage policy; move to a proper
  tile provider/self-host behind the existing provider abstraction if throttled.
- **Push notifications** for order status (web-push exists; add native push).
- **Saved locations / referrals / order-history enrichments** — M5.
