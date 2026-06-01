import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getTgContext } from '@/lib/tg-auth';
import { FULL_TANK_MAX_LITERS } from '@/lib/constants';

export const runtime = 'nodejs';

const createSchema = z.object({
  carId: z.string().cuid(),
  fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']),
  volume: z.number().int().min(0).max(FULL_TANK_MAX_LITERS),
  isFullTank: z.boolean().optional(),
  address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
});

// GET: the driver's own orders (most recent first).
export async function GET(req: Request) {
  const ctx = await getTgContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }
  if (!ctx.driver) {
    return NextResponse.json({ error: 'Not linked' }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: { createdById: ctx.driver.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { car: { select: { plateNumber: true } } },
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      status: o.status,
      fuelType: o.fuelType,
      volume: o.volume,
      isFullTank: o.isFullTank,
      plateNumber: o.car.plateNumber,
      address: o.address,
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt,
    })),
  );
}

// POST: create a fuel order. Mirrors the DRIVER branch of /api/orders.
export async function POST(req: Request) {
  const ctx = await getTgContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid init data' }, { status: 401 });
  }
  if (!ctx.driver) {
    return NextResponse.json({ error: 'Not linked' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'Invalid data' },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const car = await prisma.car.findUnique({ where: { id: data.carId } });
  if (!car) {
    return NextResponse.json({ error: 'Машина не найдена' }, { status: 404 });
  }

  // Driver may only order for cars assigned to them.
  const assigned = await prisma.driverCar.findUnique({
    where: { driverId_carId: { driverId: ctx.driver.id, carId: data.carId } },
  });
  if (!assigned) {
    return NextResponse.json({ error: 'Машина не закреплена за вами' }, { status: 403 });
  }

  const order = await prisma.order.create({
    data: {
      carId: data.carId,
      fuelType: data.fuelType,
      volume: data.volume ?? 0,
      isFullTank: data.isFullTank ?? false,
      status: 'CREATED',
      address: data.address ?? undefined,
      notes: data.notes ?? undefined,
      createdById: ctx.driver.id,
    },
  });

  return NextResponse.json(order);
}
