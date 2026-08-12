import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Status/details of a single client order. Used by the order page's 10s poll.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, clientId: user.id },
    include: { clientCar: { select: { plate: true, model: true } } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: order.id,
    status: order.status,
    fuelType: order.fuelType,
    volume: order.volume,
    dispensedVolume: order.dispensedVolume,
    pricePerLiter: order.pricePerLiter,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    scheduledFor: order.scheduledFor,
    address: order.address,
    lat: order.lat,
    lng: order.lng,
    plate: order.clientCar?.plate ?? null,
    model: order.clientCar?.model ?? null,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    rating: order.rating,
  });
}
