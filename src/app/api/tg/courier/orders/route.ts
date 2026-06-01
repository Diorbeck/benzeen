import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTgContext } from '@/lib/tg-auth';

export const runtime = 'nodejs';

// Courier's work list inside the Mini App: live orders available to take plus
// the courier's own in-progress orders. Telegram-authenticated (no session).
export async function GET(req: Request) {
  const ctx = await getTgContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }
  if (!ctx.courier) {
    return NextResponse.json({ error: 'Not a courier' }, { status: 403 });
  }

  const courierId = ctx.courier.id;
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: 'RECEIVED', assignedToId: null },
        { assignedToId: courierId, status: { in: ['COURIER_ASSIGNED', 'IN_DELIVERY'] } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: { car: { select: { plateNumber: true } } },
    take: 50,
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      plateNumber: o.car.plateNumber,
      fuelType: o.fuelType,
      volume: o.volume,
      isFullTank: o.isFullTank,
      status: o.status,
      address: o.address,
      lat: o.lat,
      lng: o.lng,
      createdAt: o.createdAt,
      mine: o.assignedToId === courierId,
    })),
  );
}
