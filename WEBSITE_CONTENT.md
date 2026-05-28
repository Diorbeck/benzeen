# Benzeen Website — Full Content & Structure

B2B fuel delivery and fleet fuel management platform. This document lists all pages, sections, features, and technical structure.

---

## 1. Tech Stack

- **Framework:** Next.js 15 (App Router)
- **i18n:** next-intl (RU, EN, UZ)
- **Auth:** NextAuth.js
- **DB:** Prisma
- **UI:** Tailwind CSS, Radix UI, Framer Motion, next-themes (dark/light)
- **Data:** TanStack Query (React Query)

---

## 2. Locales & Routing

- **Locales:** `ru` (default), `en`, `uz`
- **URL pattern:** `/{locale}/...` (e.g. `/ru`, `/en/login`, `/uz/dashboard`)
- **Persistence:** Selected locale stored in cookie (`NEXT_LOCALE`)
- **Protected routes:** `/dashboard/*` — redirect to `/{locale}/login` if not authenticated
- **Login redirect:** If already logged in, `/login` redirects to `/{locale}/dashboard`

---

## 3. Public Pages

### 3.1 Home (Landing) — `/[locale]`

Rendered by `Landing` with these sections in order:

| # | Section | Component | Anchor / Notes |
|---|---------|-----------|----------------|
| 1 | **Hero** | `Hero` | Headline, subtext, primary CTA “Get Started”, secondary “View Dashboard”. Role selection modal (Manager / Driver). Dashboard preview mock + floating notification cards (“Fuel request approved”, “Delivery scheduled”, “Fuel limit updated”). |
| 2 | **How It Works** | `HowItWorks` | `#how-it-works`. 4 steps: Driver requests fuel → Manager approves → Fuel delivered → Reporting. |
| 3 | **Features** | `Features` | `#features`. 5 features: Fleet fuel limits, Driver ordering, Delivery tracking, Automated invoices, Analytics dashboard. |
| 4 | **Benefits** | `Benefits` | 4 cards: Fuel Cost Control, Fleet Visibility, Automated Reports, Fast Fuel Delivery. |
| 5 | **Interactive Fleet Demo** | `InteractiveDemo` | `#interactive-demo`. Vehicle dropdown (TRK-102, 215, 088, 411), fuel limit slider 0–500 L, “Simulate Fuel Request”, “Simulate Delivery”, live notification/status UI. |
| 6 | **Dashboard Preview** | `DashboardPreview` | `#dashboard-preview`. Mock fleet table + monthly usage chart. |
| 7 | **Social Proof** | `SocialProof` | “Trusted by Fleet Operators” — Taxi, Logistics, Delivery, Construction (grayscale logos, hover). |
| 8 | **Pricing** | `Pricing` | `#pricing`. Starter, Business (Popular), Enterprise. Plan name, description, features, “Contact sales” CTA. |
| 9 | **Contact** | `Contact` | `#contact`. Phone, Telegram, support email, office hours. Form: Name, Company, Phone, Message. |
| 10 | **Footer** | `Footer` | Nav links, Language switcher, copyright, location (Tashkent). |

**Header (global on landing):** Logo, nav (Features, How It Works, Demo, Pricing, Contact), Language switcher, Theme toggle, Sign In / Get Started.

---

### 3.2 Login — `/[locale]/login`

- **Role selection:** Query `?mode=manager` or `?mode=driver` (also set from Hero modal).
- **Manager:** Email + password. Demo: admin@benzeen.uz / 123, company@benzeen.uz / company123.
- **Driver:** Vehicle number + phone + SMS code (placeholder flow).
- **Tabs:** Manager | Driver.
- **Redirect:** After sign-in → `/{locale}/dashboard`.
- **Fully internationalized** (titles, placeholders, errors, demo text).

---

## 4. Dashboard (Authenticated)

Base path: `/[locale]/dashboard`. Layout: `DashboardShell` (sidebar + header). Nav depends on **user role**.

### 4.1 Roles & Dashboard Nav

| Role | Nav items |
|------|-----------|
| **SUPER_ADMIN** | Overview, Admin, Companies, Cars, Drivers, Orders, Invoices, Settings |
| **COMPANY_ADMIN** | Overview, Cars, Drivers, Orders, Invoices, Settings |
| **DRIVER** | My vehicles (overview), Cars, Orders, Settings |
| **COURIER** | Overview, Orders, Settings |

Header: Notification bell, Language switcher, Theme toggle, Sign out.

---

### 4.2 Dashboard Pages

| Route | Who | Content |
|-------|-----|--------|
| `/[locale]/dashboard` | All | **Overview:** KPIs (remaining liters, active cars, pending approvals, delivered today), per-car limits, usage chart, recent orders. Driver sees “My vehicles” + create order. |
| `/[locale]/dashboard/admin` | SUPER_ADMIN | Admin dashboard: companies, cars, orders; filters; counts. |
| `/[locale]/dashboard/companies` | SUPER_ADMIN | Companies list. |
| `/[locale]/dashboard/cars` | SUPER_ADMIN, COMPANY_ADMIN | Cars list; “Add car”. |
| `/[locale]/dashboard/cars/new` | SUPER_ADMIN, COMPANY_ADMIN | Add car form: plate, model, fuel type, monthly limit, tank capacity. |
| `/[locale]/dashboard/drivers` | SUPER_ADMIN, COMPANY_ADMIN | Drivers section; add driver (name, phone, password/SMS, car). |
| `/[locale]/dashboard/orders` | All with Orders nav | Orders list; filters (status, fuel); Create order; Export CSV. Statuses: Created, Pending approval, Assigned, On route, Delivered, Closed. |
| `/[locale]/dashboard/orders/new` | All with Orders nav | Create order: car, delivery address, volume / full tank. |
| `/[locale]/dashboard/invoices` | SUPER_ADMIN, COMPANY_ADMIN | Invoices. |
| `/[locale]/dashboard/settings` | All | Settings. |

**Loading:** Shared `loading.tsx` under dashboard (e.g. “Loading...” or skeleton).

---

## 5. API Routes

| Method | Route | Purpose |
|--------|--------|---------|
| * | `/api/auth/[...nextauth]` | NextAuth (credentials, session). |
| GET/POST | `/api/analytics/usage` | Usage analytics. |
| * | `/api/companies` | Companies CRUD. |
| * | `/api/cars` | Cars CRUD. |
| * | `/api/orders` | Orders list/create. |
| GET/PATCH | `/api/orders/[id]` | Single order. |
| GET | `/api/orders/cars` | Cars for orders. |
| * | `/api/notifications` | Notifications. |
| POST | `/api/notifications/read` | Mark read. |
| * | `/api/couriers` | Couriers. |
| * | `/api/courier/orders` | Courier orders. |
| GET/PATCH | `/api/courier/orders/[id]` | Single courier order (e.g. take/deliver). |
| POST | `/api/contact` | Contact form submit. |
| GET | `/api/prices` | Fuel prices. |

---

## 6. Internationalization (i18n)

- **Files:** `messages/ru.json`, `messages/en.json`, `messages/uz.json`
- **Namespaces used in app:**  
  `common`, `hero`, `features`, `howItWorks`, `interactiveDemo`, `benefits`, `dashboardPreview`, `socialProof`, `pricing`, `contact`, `login`, `dashboard`, `admin`, `driverDashboard`, `drivers`, `cars`, `addCarForm`, `createOrder`, `orders`, `notifications`, `footer`, `loading`
- **UI:** Language switcher in header (landing) and dashboard; footer shows locale awareness. All user-facing strings go through translation keys (no hardcoded copy in components).

---

## 7. Theming & UX

- **Dark/Light:** next-themes; toggle in header/dashboard. Key: `benzeen-theme`.
- **Visual:** Dark premium SaaS (gray-950, white/5 borders, primary blue accents). Cards: rounded-2xl, hover lift, soft shadows. Buttons: hover glow, elevation.
- **Motion:** Framer Motion for section reveals, hover, modals, chart updates. Range slider and demo panel use smooth transitions.
- **Accessibility:** Semantic HTML, ARIA where needed, focus states, `lang` on `<html>` per locale (`SetLocaleHtml`).

---

## 8. File Structure (Relevant)

```
src/
├── app/
│   ├── layout.tsx                 # Root layout, Providers, metadata
│   ├── globals.css                # Tailwind, grid, range slider, etc.
│   ├── [locale]/
│   │   ├── layout.tsx             # next-intl provider, SetLocaleHtml, metadata
│   │   ├── page.tsx               # Landing
│   │   ├── login/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx         # Shell, auth
│   │       ├── loading.tsx
│   │       ├── page.tsx           # Overview
│   │       ├── admin/page.tsx
│   │       ├── companies/page.tsx
│   │       ├── cars/page.tsx, cars/new/page.tsx
│   │       ├── drivers/page.tsx
│   │       ├── orders/page.tsx, orders/new/page.tsx
│   │       ├── invoices/page.tsx
│   │       └── settings/page.tsx
│   └── api/                       # All API routes listed above
├── components/
│   ├── landing/                   # Hero, HowItWorks, Features, Benefits,
│   │                             # InteractiveDemo, DashboardPreview,
│   │                             # SocialProof, Pricing, Contact, Footer, Header
│   ├── dashboard/                # Shell, driver-dashboard, admin, cars-list,
│   │                             # add-car-form, drivers-section, orders, etc.
│   ├── ui/                       # Button, etc.
│   ├── providers.tsx
│   ├── language-switcher.tsx
│   ├── theme-toggle.tsx
│   └── set-locale-html.tsx
├── i18n/routing.ts               # ru, en, uz; default ru
└── middleware.ts                 # intl + auth (dashboard protect, login redirect)
messages/
├── ru.json
├── en.json
└── uz.json
```

---

## 9. Summary

- **Public:** One landing (10 sections + header/footer), one login page. Locales: ru, en, uz.
- **App:** Dashboard with role-based nav (Super Admin, Company Admin, Driver, Courier) and pages for overview, admin, companies, cars, drivers, orders, invoices, settings. All behind NextAuth.
- **APIs:** Auth, companies, cars, orders, courier orders, notifications, contact, prices, analytics.
- **Content:** Fully driven by `messages/*.json`; no user-facing text hardcoded in components. Theme and language are persistent and available site-wide.
