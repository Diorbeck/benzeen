import { NextResponse } from 'next/server';
import type { FuelType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  aggregateStocks,
  isStationFuelType,
  isStationOnline,
  type FuelStock,
} from '@/lib/stations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Публичный список подключённых АЗС с остатками по видам топлива — данные для
// карты в клиентском приложении.
//
// Архивные АЗС не отдаются вообще. Приостановленные отдаются со статусом: точка
// на карте, которая просто исчезла, выглядит как поломка приложения, а точка с
// подписью «не работает» объясняет себя сама (тот же приём, что на /propan).
//
// Сортировка по расстоянию делается на клиенте: там есть геопозиция и она
// меняется на ходу, а страна маленькая — весь список умещается в один ответ.

export type StationListItem = {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  region: string | null;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'PAUSED';
  online: boolean;
  lastSeenAt: string | null;
  stocks: (Omit<FuelStock, 'fuelType'> & { fuelType: FuelType; priceUzs: number | null })[];
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fuelParam = url.searchParams.get('fuel');
  const fuelFilter = fuelParam && isStationFuelType(fuelParam) ? (fuelParam as FuelType) : null;
  if (fuelParam && !fuelFilter) {
    return NextResponse.json({ error: 'Unknown fuel type' }, { status: 400 });
  }

  const stations = await prisma.fuelStation.findMany({
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      brand: true,
      address: true,
      region: true,
      lat: true,
      lng: true,
      status: true,
      lastSeenAt: true,
      tanks: {
        select: {
          fuelType: true,
          status: true,
          capacityL: true,
          currentLevelL: true,
          lastReadingAt: true,
        },
      },
      prices: { select: { fuelType: true, priceUzs: true } },
    },
  });

  const now = new Date();

  const items: StationListItem[] = stations
    .map((s) => {
      const priceByFuel = new Map(s.prices.map((p) => [p.fuelType, p.priceUzs]));
      const stocks = aggregateStocks(s.tanks, now).map((stock) => ({
        ...stock,
        priceUzs: priceByFuel.get(stock.fuelType) ?? null,
      }));

      return {
        id: s.id,
        name: s.name,
        brand: s.brand,
        address: s.address,
        region: s.region,
        lat: s.lat,
        lng: s.lng,
        status: s.status as 'ACTIVE' | 'PAUSED',
        online: isStationOnline(s.lastSeenAt, now),
        lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
        stocks,
      };
    })
    .filter((s) => (fuelFilter ? s.stocks.some((st) => st.fuelType === fuelFilter) : true));

  return NextResponse.json({ stations: items, generatedAt: now.toISOString() });
}
