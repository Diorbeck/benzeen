# Benzeen – Local setup

## 1. Database (required for signup, login, verification)

The app expects PostgreSQL at `localhost:5433` (see `.env` / `DATABASE_URL`).

### Option A: Docker (recommended)

**Install:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Then in the project folder run:

```bash
docker compose up -d
sleep 5
npx prisma db push
```

### Option B: Hosted PostgreSQL (no Docker)

Use [Neon](https://neon.tech), [Supabase](https://supabase.com), or any Postgres host. Create a database and set in `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
```

Then:

```bash
npx prisma db push
```

### Option C: Local PostgreSQL (no Docker)

Install Postgres and create a DB. Use port **5433** (or change `DATABASE_URL` to your port). Then:

```bash
npx prisma db push
```

---

## 2. Environment

```bash
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET, optional RESEND_API_KEY for email codes
```

**Verification (email & SMS):** To send codes to any email or by phone, see **[docs/VERIFICATION.md](docs/VERIFICATION.md)** — domain verification (Resend) and phone setup (Twilio).

---

## 3. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign up; if the DB is running and schema is pushed, verification will work.
