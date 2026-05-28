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
