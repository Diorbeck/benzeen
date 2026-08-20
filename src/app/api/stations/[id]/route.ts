import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aggregateStocks, isStationOnline } from '@/lib/stations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Карточка одной АЗС: остатки по видам топлива, цены и список колонок. Нужна
// экрану подтверждения заправки — клиент выбирает колонку по номеру, который
// написан на объекте.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const station = await prisma.fuelStation.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      brand: true,
      address: true,
      lat: true,
      lng: true,
      status: true,
      lastSeenAt: true,
      tanks: {
        select: {
          fuelType: true,
          capacityL: true,
          currentLevelL: true,
          lastReadingAt: true,
          minLevelL: true,
          status: true,
        },
      },
      prices: { select: { fuelType: true, priceUzs: true } },
      dispensers: {
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          status: true,
          fuelTypes: true,
          identificationMode: true,
          lastSeenAt: true,
        },
      },
    },
  });

  if (!station || station.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Экрану выбора колонки нужно знать, какие заняты прямо сейчас: активная
  // сессия (резерв или заливка) делает колонку недоступной для второго клиента.
  const activeSessions = await prisma.fuelingSession.findMany({
    where: {
      dispenserId: { in: station.dispensers.map((d) => d.id) },
      status: { in: ['RESERVED', 'FLOWING'] },
    },
    select: { dispenserId: true },
  });
  const busyIds = new Set(activeSessions.map((s) => s.dispenserId));

  const priceOf = (fuelType: string) =>
    station.prices.find((p) => p.fuelType === fuelType)?.priceUzs ?? null;

  return NextResponse.json({
    station: {
      id: station.id,
      name: station.name,
      brand: station.brand,
      address: station.address,
      lat: station.lat,
      lng: station.lng,
      status: station.status,
      online: isStationOnline(station.lastSeenAt),
      stocks: aggregateStocks(station.tanks).map((s) => ({ ...s, priceUzs: priceOf(s.fuelType) })),
      dispensers: station.dispensers.map((d) => ({
        id: d.id,
        number: d.number,
        status: d.status,
        fuelTypes: d.fuelTypes,
        identificationMode: d.identificationMode,
        online: isStationOnline(d.lastSeenAt),
        busy: busyIds.has(d.id),
      })),
    },
  });
}
