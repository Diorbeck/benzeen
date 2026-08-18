import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyControllerKey } from '@/lib/stations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Приём телеметрии от пограничного контроллера на АЗС.
//
// Контроллер шлёт пачку показаний, а не по одному: при потере связи он копит
// их у себя и отдаёт очередью, когда связь вернулась. Поэтому в теле массив, а
// время измерения приходит от контроллера (measuredAt) и не подменяется нашим
// временем получения — по расхождению этих двух отметок и виден офлайн.
//
// Авторизация: Bearer-ключ конкретной АЗС. В базе лежит только его хеш.

type ReadingInput = {
  /** Идентификатор резервуара в нашей базе либо его метка на объекте. */
  tankId?: unknown;
  tankLabel?: unknown;
  levelL?: unknown;
  volumeL?: unknown;
  temperatureC?: unknown;
  measuredAt?: unknown;
};

type Body = {
  stationId?: unknown;
  readings?: unknown;
  /** Номера колонок, которые контроллер видит живыми. */
  dispensersOnline?: unknown;
};

const MAX_READINGS_PER_REQUEST = 500;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const stationId = typeof body.stationId === 'string' ? body.stationId : '';
  if (!stationId) {
    return NextResponse.json({ error: 'stationId required' }, { status: 400 });
  }

  const station = await prisma.fuelStation.findUnique({
    where: { id: stationId },
    select: {
      id: true,
      status: true,
      controllerKeyHash: true,
      tanks: { select: { id: true, label: true, capacityL: true } },
    },
  });

  // Неизвестная АЗС и неверный ключ отвечают одинаково: иначе перебор ключей
  // превращается в способ узнать, какие АЗС вообще подключены.
  if (!station || !verifyControllerKey(key, station.controllerKeyHash)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (station.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Station archived' }, { status: 403 });
  }

  const rawReadings = Array.isArray(body.readings) ? (body.readings as ReadingInput[]) : [];
  if (rawReadings.length > MAX_READINGS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many readings, max ${MAX_READINGS_PER_REQUEST}` },
      { status: 413 },
    );
  }

  const byId = new Map(station.tanks.map((t) => [t.id, t]));
  const byLabel = new Map(station.tanks.map((t) => [t.label, t]));

  const now = new Date();
  const accepted: {
    tankId: string;
    levelL: number;
    volumeL: number | null;
    temperatureC: number | null;
    measuredAt: Date;
  }[] = [];
  const rejected: { index: number; reason: string }[] = [];

  rawReadings.forEach((raw, index) => {
    const tank =
      (typeof raw.tankId === 'string' ? byId.get(raw.tankId) : undefined) ??
      (typeof raw.tankLabel === 'string' ? byLabel.get(raw.tankLabel) : undefined);
    if (!tank) {
      rejected.push({ index, reason: 'unknown tank' });
      return;
    }

    const levelL = num(raw.levelL);
    if (levelL === null || levelL < 0) {
      rejected.push({ index, reason: 'levelL must be a non-negative number' });
      return;
    }
    // Показание выше физической ёмкости — это неисправность датчика или его
    // неверная калибровка. Такое значение отбрасывается, а не «подрезается»:
    // подрезанное значение выглядело бы как исправный полный резервуар.
    if (levelL > tank.capacityL * 1.05) {
      rejected.push({ index, reason: 'levelL exceeds tank capacity' });
      return;
    }

    const measuredAt = parseDate(raw.measuredAt) ?? now;
    // Время из будущего — сбитые часы на контроллере. Принимаем показание, но
    // с нашим временем, иначе оно навсегда останется «самым свежим».
    const safeMeasuredAt = measuredAt.getTime() > now.getTime() + 60_000 ? now : measuredAt;

    // Денормализованный уровень обновляется отдельно, ниже: сначала пишем
    // историю, потом последнее значение — и только если оно новее уже
    // сохранённого, чтобы буферизованная старая пачка не откатила остаток.
    accepted.push({
      tankId: tank.id,
      levelL,
      volumeL: num(raw.volumeL),
      temperatureC: num(raw.temperatureC),
      measuredAt: safeMeasuredAt,
    });
  });

  await prisma.$transaction(async (tx) => {
    if (accepted.length > 0) {
      await tx.tankReading.createMany({
        data: accepted.map((r) => ({
          tankId: r.tankId,
          levelL: r.levelL,
          volumeL: r.volumeL ?? undefined,
          temperatureC: r.temperatureC ?? undefined,
          measuredAt: r.measuredAt,
          source: 'SENSOR' as const,
        })),
      });

      // Последнее показание по каждому резервуару в этой пачке.
      const latest = new Map<string, { levelL: number; measuredAt: Date }>();
      for (const r of accepted) {
        const prev = latest.get(r.tankId);
        if (!prev || r.measuredAt.getTime() > prev.measuredAt.getTime()) {
          latest.set(r.tankId, { levelL: r.levelL, measuredAt: r.measuredAt });
        }
      }

      for (const [tankId, value] of latest) {
        await tx.tank.updateMany({
          // Условие на lastReadingAt — защита от отката остатка старой пачкой
          // из буфера контроллера, пришедшей после свежих данных.
          where: {
            id: tankId,
            OR: [{ lastReadingAt: null }, { lastReadingAt: { lt: value.measuredAt } }],
          },
          data: { currentLevelL: value.levelL, lastReadingAt: value.measuredAt },
        });
      }
    }

    const dispensersOnline = Array.isArray(body.dispensersOnline)
      ? (body.dispensersOnline as unknown[]).filter((n): n is number => num(n) !== null)
      : [];
    if (dispensersOnline.length > 0) {
      await tx.dispenser.updateMany({
        where: { stationId: station.id, number: { in: dispensersOnline } },
        data: { lastSeenAt: now },
      });
    }

    // Признак жизни АЗС ставится всегда, даже если все показания отбракованы:
    // связь с объектом есть, а неисправный датчик — отдельная проблема, и
    // сваливать её в «АЗС офлайн» значит терять причину.
    await tx.fuelStation.update({ where: { id: station.id }, data: { lastSeenAt: now } });
  });

  return NextResponse.json({
    ok: true,
    accepted: accepted.length,
    rejected,
    receivedAt: now.toISOString(),
  });
}
