import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as { role?: string };
    if (role !== 'COURIER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const courierId = (session.user as { id: string }).id;

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { status: 'CREATED', assignedToId: null },
          { assignedToId: courierId, status: { in: ['COURIER_ASSIGNED', 'IN_DELIVERY'] } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { car: true },
      take: 50,
    });

    return NextResponse.json(
      orders.map((o) => ({
        id: o.id,
        plateNumber: o.car.plateNumber,
        fuelType: o.fuelType,
        volume: o.volume,
        status: o.status,
        address: o.address,
        createdAt: o.createdAt,
      })),
    );
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

