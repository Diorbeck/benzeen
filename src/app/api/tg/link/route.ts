import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { validateInitData } from '@/lib/telegram';
import { TG_INIT_DATA_HEADER } from '@/lib/tg-auth';
import { checkAuthRateLimit, clientIpFromHeaders } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const schema = z.object({
  phone: z.string().min(3).max(32),
  password: z.string().min(1).max(200),
});

// One-time linking: a driver enters their phone + password once. On success we
// store their Telegram id, so every later Mini App request authenticates
// silently via initData (see /lib/tg-auth).
export async function POST(req: Request) {
  // Validate the Telegram identity first (no point checking a password for an
  // unverified Telegram user).
  const initData = req.headers.get(TG_INIT_DATA_HEADER);
  const validated = initData ? validateInitData(initData) : null;
  if (!validated) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }

  // Brute-force protection (shared limiter with the main auth endpoints).
  const ip = clientIpFromHeaders(req.headers);
  const rl = await checkAuthRateLimit(`tg-link:${ip}`);
  if (rl && !rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Введите телефон и пароль' }, { status: 400 });
  }

  const phone = parsed.data.phone.trim();
  const telegramId = String(validated.user.id);

  const driver = await prisma.user.findFirst({
    where: { phone, role: 'DRIVER' },
    select: { id: true, name: true, phone: true, passwordHash: true, telegramId: true },
  });

  // Same generic error for "no such driver" and "wrong password" to avoid
  // leaking which phone numbers exist.
  if (!driver?.passwordHash) {
    return NextResponse.json({ error: 'Неверный телефон или пароль' }, { status: 401 });
  }
  const valid = await bcrypt.compare(parsed.data.password, driver.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Неверный телефон или пароль' }, { status: 401 });
  }

  // If this driver was already linked to a different Telegram account, move the
  // link to the current one (driver switched phones/accounts).
  if (driver.telegramId && driver.telegramId !== telegramId) {
    // proceed to overwrite below
  }

  try {
    await prisma.user.update({
      where: { id: driver.id },
      data: { telegramId },
    });
  } catch {
    // Unique violation: this Telegram id is linked to another driver. Clear the
    // stale link and retry once.
    await prisma.user.updateMany({
      where: { telegramId },
      data: { telegramId: null },
    });
    await prisma.user.update({
      where: { id: driver.id },
      data: { telegramId },
    });
  }

  return NextResponse.json({
    linked: true,
    driver: { id: driver.id, name: driver.name, phone: driver.phone },
  });
}
