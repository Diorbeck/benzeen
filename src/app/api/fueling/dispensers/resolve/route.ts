import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pickNearestBeacon } from '@/lib/ble-proximity';
import { aggregateStocks, isStationOnline } from '@/lib/stations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Модуль 3 ТЗ v2, уровень BLE: приложение присылает, какие маячки слышит и с
// какой силой, а сервер отвечает, у какой колонки стоит клиент. Дальше телефон
// показывает «Вы у колонки №X — подтвердить?» и уходит в /api/fueling/sessions
// c identifiedBy: 'BLE'.
//
// Сервер намеренно не создаёт заправку сам: подтверждение остаётся за клиентом,
// иначе случайно пойманный маячок соседней колонки блокировал бы деньги на карте.

const schema = z.object({
  beacons: z
    .array(
      z.object({
        beaconId: z.string().min(1).max(128),
        rssi: z.number().min(-127).max(0),
      }),
    )
    .min(1)
    .max(32),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  const pick = pickNearestBeacon(data.beacons);
  if (!pick) {
    // Маячков не слышно или все слишком далеко — это нормальная ситуация, а не
    // ошибка: приложение просто оставляет ручной выбор колонки.
    return NextResponse.json({ match: null, reason: 'NO_BEACON_IN_RANGE' });
  }

  const dispenser = await prisma.dispenser.findUnique({
    where: { bleBeaconId: pick.beaconId },
    select: {
      id: true,
      number: true,
      status: true,
      fuelTypes: true,
      identificationMode: true,
      station: {
        select: {
          id: true,
          name: true,
          brand: true,
          address: true,
          status: true,
          lastSeenAt: true,
          tanks: {
            select: {
              fuelType: true,
              capacityL: true,
              currentLevelL: true,
              lastReadingAt: true,
              status: true,
            },
          },
          prices: { select: { fuelType: true, priceUzs: true } },
        },
      },
    },
  });

  if (!dispenser || dispenser.station.status === 'ARCHIVED') {
    return NextResponse.json({ match: null, reason: 'BEACON_UNKNOWN' });
  }
  if (dispenser.status !== 'ACTIVE') {
    return NextResponse.json({ match: null, reason: 'DISPENSER_INACTIVE' });
  }

  const station = dispenser.station;
  const online = isStationOnline(station.lastSeenAt);
  const stocks = aggregateStocks(station.tanks);
  const priceOf = (fuelType: string) => station.prices.find((p) => p.fuelType === fuelType)?.priceUzs ?? null;

  return NextResponse.json({
    match: {
      // confident: false — колонки для телефона неразличимы, приложение обязано
      // показать выбор из нескольких, а не молча предложить одну.
      confident: pick.confident,
      rssi: pick.rssi,
      marginDb: pick.marginDb,
      dispenser: {
        id: dispenser.id,
        number: dispenser.number,
        fuelTypes: dispenser.fuelTypes,
        identificationMode: dispenser.identificationMode,
      },
      station: {
        id: station.id,
        name: station.name,
        brand: station.brand,
        address: station.address,
        online,
        stocks: stocks.map((s) => ({ ...s, priceUzs: priceOf(s.fuelType) })),
      },
    },
  });
}
