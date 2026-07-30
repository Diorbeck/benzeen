import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { COURIER_LOCATION_MAX_AGE_MS } from '@/lib/constants';

// Live tracking for the order owner (M3). Returns only the order status and, at
// most, the assigned courier's coordinates — and only while the delivery is
// active AND the courier location is fresh (<10 min). No other courier data is
// ever exposed.
const ACTIVE = new Set(['COURIER_ASSIGNED', 'IN_DELIVERY']);
// Tracking freshness is a bit more lenient than dispatch eligibility (5 min).
const TRACKING_MAX_AGE_MS = Math.max(COURIER_LOCATION_MAX_AGE_MS, 10 * 60 * 1000);

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
    where: { id, clientId: user.id }, // owner-only; other clients' orders → 404
    select: { status: true, assignedToId: true },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let courier: { lat: number; lng: number; updatedAt: string } | null = null;
  if (ACTIVE.has(order.status) && order.assignedToId) {
    const loc = await prisma.courierLocation.findUnique({
      where: { courierId: order.assignedToId },
      select: { lat: true, lng: true, updatedAt: true },
    });
    if (loc && Date.now() - loc.updatedAt.getTime() <= TRACKING_MAX_AGE_MS) {
      courier = { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt.toISOString() };
    }
  }

  return NextResponse.json({ status: order.status, courier });
}
