import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bookableSlots } from '@/lib/propane';

// Bookable 15-minute slots for one point with per-slot availability:
// free = postsCount − BOOKED bookings at that slotStart.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const point = await prisma.propanePoint.findUnique({
    where: { id },
    select: { id: true, status: true, postsCount: true },
  });
  if (!point) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (point.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'point_paused' }, { status: 409 });
  }

  const now = new Date();
  const slots = bookableSlots(now);
  const from = slots[0];
  const to = slots[slots.length - 1];

  const booked = await prisma.propaneBooking.groupBy({
    by: ['slotStart'],
    where: {
      pointId: id,
      status: 'BOOKED',
      slotStart: { gte: from, lte: to },
    },
    _count: { _all: true },
  });
  const bookedBySlot = new Map(booked.map((b) => [b.slotStart.getTime(), b._count._all]));

  return NextResponse.json({
    slots: slots.map((s) => ({
      start: s.toISOString(),
      free: Math.max(0, point.postsCount - (bookedBySlot.get(s.getTime()) ?? 0)),
    })),
  });
}
