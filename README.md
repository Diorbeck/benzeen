# Benzeen — B2B Fuel Delivery Platform

Premium B2B fuel delivery platform for Tashkent, Uzbekistan. Control limits, manage your fleet, fast delivery.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui, Framer Motion, next-intl (RU/EN/UZ)
- **Backend:** Next.js API routes, Prisma ORM, PostgreSQL
- **Auth:** NextAuth (credentials)
- **State:** TanStack Query
- **Validation:** Zod

## Prerequisites

- Node.js 20+
- pnpm
- Docker (for PostgreSQL)

## Quick Start

```bash
# Install dependencies (use pnpm or npm)
pnpm install
# or: npm install

# Start PostgreSQL
pnpm db:up

# Copy env and set NEXTAUTH_SECRET
cp .env.example .env
# Edit .env: generate NEXTAUTH_SECRET with: openssl rand -base64 32

# Push schema (or run migrations)
pnpm db:push
# or for migrations: pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/ru`.

## Демо-АЗС для локальной разработки

Карта АЗС и сценарий заправки живут на данных датчиков: без свежих показаний
станция честно уходит в «Нет связи», а топливо — в «Нет данных». Чтобы всё
работало локально, есть сид демо-станций и фоновый имитатор контроллеров,
который кормит **все** станции с `isDemo=true` (обновляет `lastSeenAt`, пишет
`TankReading` и поддерживает `currentLevelL`).

```bash
# Одна команда: пересеять демо-АЗС и запустить имитатор (держите в фоне)
npm run demo:stations

# То же, но в фоне с логом:
nohup npm run demo:stations > /tmp/benzeen-demo.log 2>&1 &
```

Что даёт сид (`prisma/seed-stations.ts`, идемпотентный — можно перезапускать):

- 4 демо-АЗС с `isDemo=true`, ценами по всем заявленным видам топлива и
  колонками ACTIVE (на «АЗС Мирзо-Улугбек» — 10 колонок, одна специально
  DISABLED, и все 5 видов топлива);
- разные уровни в резервуарах: где-то почти полный бак, где-то ~8% — на
  карточке видно и «в наличии», и «заканчивается»;
- на «АЗС Самарканд-Восток» у 95-го датчик «не подключён» (без показаний) —
  состояние «нет данных» тоже проверяемо.

Демо-точки подписаны в интерфейсе бейджем «Демо» — цифры на них выдуманные.
После пересоздания базы всё восстанавливается той же командой.

**Только для локальной разработки.** На проде демо-станций быть не должно: сид
запускается только вручную (`prisma db seed` на деплое выполняет лишь
`prisma/seed.ts`, а `vercel-build` сидов не запускает вовсе), имитатор — обычный
локальный процесс и в сборку не входит.

## Demo Users

| Role          | Email               | Password   |
|-------------- |---------------------|------------|
| Super Admin   | admin@benzeen.uz    | 123        |
| Company Admin | company@benzeen.uz  | company123 |
| Driver        | driver@benzeen.uz   | driver123  |
| Courier       | courier@benzeen.uz  | courier123 |

## Bootstrap SUPER_ADMIN (recommended)

You can bootstrap the **Super Admin** account from environment variables. If these are set, the app will ensure the user exists and will update the password automatically:

- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## Troubleshooting

1. **Build fails with "window is not defined"** — Recharts is loaded only on the client (ssr: false).
2. **NEXTAUTH_SECRET** — Generate: `openssl rand -base64 32`
3. **Prisma** — Run `pnpm db:generate` after schema changes.

## Scripts

| Command         | Description                    |
|-----------------|--------------------------------|
| `pnpm dev`      | Start dev server (next dev)    |
| `pnpm build`    | Production build               |
| `pnpm start`    | Start production server        |
| `pnpm test`     | Run Vitest unit tests          |
| `pnpm db:up`    | Start PostgreSQL (Docker)      |
| `pnpm db:migrate` | Run migrations               |
| `pnpm db:push`  | Push schema (no migration)     |
| `pnpm db:seed`  | Seed demo data                 |
| `pnpm db:studio`| Open Prisma Studio             |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/           # Locale-prefixed routes
│   │   ├── dashboard/      # Dashboard (protected)
│   │   ├── login/          # Auth
│   │   └── page.tsx        # Landing
│   ├── api/                # API routes
│   └── globals.css
├── components/
│   ├── dashboard/          # Dashboard components
│   ├── landing/            # Landing page sections
│   └── ui/                 # UI primitives
├── i18n/                   # next-intl config
├── lib/                    # Utilities, auth, prisma
└── types/                  # TypeScript types
```

## Business Logic

- **Limits:** Each car has a monthly liter limit. Orders reduce the limit.
- **Full tank:** Requires admin approval. Max 80L (configurable).
- **Order flow:** Created → Pending Approval (full tank) / Assigned → On Route → Delivered → Closed

## New Features (UI Upgrade)

- **Landing hero:** Premium flow lines, soft glow CTA, micro-parallax grid, Inter font
- **Typography:** Inter font with consistent scale (headings, body, captions)
- **Route progress:** Top progress bar on route changes (nprogress)
- **Skeleton loaders:** Tables and cards show skeletons while loading
- **Orders table:** Sticky header, row hover, status chips, quick filters (status, product, date range), CSV export (Company Admin + Super Admin)
- **Dashboard KPIs:** Remaining liters, active cars, pending approvals, delivered today, usage chart, per-car limit progress bars
- **Fast Order:** localStorage for last car & address; big volume buttons; clear Full Tank flow
- **Notifications:** Bell icon in header; notifications for: limit below 20%, full tank pending, courier assigned, order delivered
- **Export:** CSV export for Orders with date range filter

## Migrations

Run after adding Notification model:

```bash
pnpm prisma migrate dev --name add_notifications
# or for existing DB: pnpm db:push
```

## Testing

```bash
pnpm test
pnpm lint
pnpm build
```

## License

Proprietary.
