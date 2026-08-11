import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Operator marks a booking as served (only from BOOKED). Super-admins can too —
// they cover for operators.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== 'PROPANE_OPERATOR' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'forbidden' }, { status: user?.id ? 403 : 401 });
  }

  const { id } = await params;
  const booking = await prisma.propaneBooking.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (booking.status !== 'BOOKED') {
    return NextResponse.json({ error: 'not_serveable' }, { status: 409 });
  }

  await prisma.propaneBooking.update({ where: { id }, data: { status: 'SERVED' } });
  return NextResponse.json({ ok: true, status: 'SERVED' });
}

// Operator's queue for one point+day lives in GET /api/admin/propane/points.
