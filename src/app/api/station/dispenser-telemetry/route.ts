import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyControllerKey } from '@/lib/stations';
import { recordDispenserTick } from '@/lib/fueling-service';
import { AcquiringError } from '@/lib/acquiring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Данные с колонки в момент заправки — Модуль 2 ТЗ v2.
//
// Контроллер шлёт тик на каждый отпущенный литр и финальный пакет с flag finished.
// Тик из буфера (заливка прошла при потерянной связи) помечается buffered — по
// этой метке заливка потом отличается в кабинете АЗС и при сверках.
//
// Авторизация та же, что у телеметрии резервуаров: Bearer-ключ АЗС, в базе только
// его хеш.

const schema = z.object({
  stationId: z.string().min(1),
  dispenserNumber: z.number().int().positive(),
  liters: z.number().min(0).max(2000),
  amountUzs: z.number().int().min(0).max(100_000_000).optional(),
  finished: z.boolean().optional(),
  buffered: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  const station = await prisma.fuelStation.findUnique({
    where: { id: data.stationId },
    select: { id: true, status: true, controllerKeyHash: true },
  });
  if (!station || !verifyControllerKey(key, station.controllerKeyHash)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (station.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Station archived' }, { status: 403 });
  }

  // Колонка живая — отмечаем и её, и объект: кабинет АЗС считает статус отсюда.
  await Promise.all([
    prisma.dispenser.updateMany({
      where: { stationId: station.id, number: data.dispenserNumber },
      data: { lastSeenAt: new Date() },
    }),
    prisma.fuelStation.update({ where: { id: station.id }, data: { lastSeenAt: new Date() } }),
  ]);

  try {
    const state = await recordDispenserTick(data);
    if (!state) {
      // Заливка без сессии в приложении: клиент платит на месте картой или
      // наличными. Это не ошибка контроллера — ему нечего повторять.
      return NextResponse.json({ accepted: true, session: null });
    }
    return NextResponse.json({ accepted: true, session: state });
  } catch (e) {
    if (e instanceof AcquiringError) {
      // Банк недоступен в момент закрытия: тик принят, сессия уйдёт на сверку
      // через разбор зависших сессий, повторять контроллеру нечего.
      return NextResponse.json(
        { accepted: true, settlement: 'deferred', code: e.code },
        { status: 202 },
      );
    }
    throw e;
  }
}
