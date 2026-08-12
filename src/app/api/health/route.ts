import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Health-check для аптайм-мониторинга и алертов: живая БД (SELECT 1) + версия
// сборки. 200 когда всё в порядке, 503 когда база недоступна.
export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.NODE_ENV ?? 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'up', version });
  } catch {
    return NextResponse.json(
      { ok: false, db: 'down', version },
      { status: 503 },
    );
  }
}
