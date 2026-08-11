import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bookSlotTx, makeBookingCode, SlotFullError, validateSlot } from '@/lib/propane';

const schema = z.object({
  pointId: z.string().cuid(),
  slotStart: z.string().datetime(),
});

// My bookings (active first) — powers the "your booking" banner on /propan.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const bookings = await prisma.propaneBooking.findMany({
    where: { clientId: user.id },
    orderBy: { slotStart: 'desc' },
    take: 10,
    select: {
      id: true,
      slotStart: true,
      status: true,
      code: true,
      point: { select: { id: true, name: true, lat: true, lng: true, priceUzs: true } },
    },
  });
  return NextResponse.json({ bookings });
}

// Book a slot. Capacity per slot = the point's postsCount; a lost race or a
// duplicate booking answers 409 so the client re-picks a slot.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const slotStart = new Date(parsed.data.slotStart);

  const validity = validateSlot(slotStart, new Date());
  if (!validity.ok) {
    return NextResponse.json({ error: 'bad_slot', reason: validity.reason }, { status: 400 });
  }

  const point = await prisma.propanePoint.findUnique({
    where: { id: parsed.data.pointId },
    select: { id: true, status: true, postsCount: true },
  });
  if (!point) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (point.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'point_paused' }, { status: 409 });
  }

  // One active future booking per client keeps the queue honest.
  const existing = await prisma.propaneBooking.findFirst({
    where: { clientId: user.id, status: 'BOOKED', slotStart: { gte: new Date() } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'already_booked' }, { status: 409 });
  }

  const attempt = () =>
    prisma.$transaction(
      (tx) =>
        bookSlotTx(
          {
            countBooked: (pointId, s) =>
              tx.propaneBooking.count({ where: { pointId, slotStart: s, status: 'BOOKED' } }),
            createBooking: (data) => tx.propaneBooking.create({ data, select: { id: true, code: true } }),
          },
          {
            pointId: point.id,
            clientId: user.id!,
            slotStart,
            postsCount: point.postsCount,
            code: makeBookingCode(),
          },
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  try {
    let booking;
    try {
      booking = await attempt();
    } catch (e) {
      // Serializable write-skew abort (P2034): one retry, then give up cleanly.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        booking = await attempt();
      } else {
        throw e;
      }
    }
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    if (e instanceof SlotFullError) {
      return NextResponse.json({ error: 'slot_full' }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique (pointId, clientId, slotStart) — a double tap on the same slot.
      if (e.code === 'P2002') return NextResponse.json({ error: 'already_booked' }, { status: 409 });
      if (e.code === 'P2034') return NextResponse.json({ error: 'slot_full' }, { status: 409 });
    }
    throw e;
  }
}
