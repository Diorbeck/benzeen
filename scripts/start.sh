#!/bin/sh
set -e

echo "▶ Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "▶ Checking seed status..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(n => { process.stdout.write(String(n)); return p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); });
")

echo "   Users in DB: $USER_COUNT"

if [ "$USER_COUNT" = "0" ]; then
  echo "▶ Database empty — running seed..."
  ./node_modules/.bin/prisma db seed
else
  echo "▶ Database already seeded — skipping"
fi

echo "▶ Starting Next.js..."
exec ./node_modules/.bin/next start
