import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { B2C_MIN_ORDER_LITERS, FULL_TANK_MAX_LITERS } from '@/lib/constants';
import { dispatchB2COrderToNearest } from '@/lib/order-dispatch';

const schema = z
  .object({
    fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']),
    volume: z.number().int().positive().max(FULL_TANK_MAX_LITERS).optional(),
    isFullTank: z.boolean().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().max(500).optional(),
    // Either an existing car or a new one to create on first order.
    clientCarId: z.string().cuid().optional(),
    newCar: z
      .object({
        plate: z.string().trim().min(1).max(20),
        model: z.string().trim().max(60).optional(),
        tankCapacity: z.number().int().min(20).max(200).optional(),
      })
      .optional(),
  })
  .refine((d) => d.clientCarId || d.newCar, {
    message: 'car_required',
  });

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; role?: string } | undefined;
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const data = schema.parse(await req.json());

    // Resolve the client's car (existing or newly created).
    let car;
    if (data.clientCarId) {
      car = await prisma.clientCar.findFirst({
        where: { id: data.clientCarId, userId: user.id },
      });
      if (!car) return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    } else if (data.newCar) {
      car = await prisma.clientCar.create({
        data: {
          userId: user.id,
          plate: data.newCar.plate,
          model: data.newCar.model || null,
          tankCapacity: data.newCar.tankCapacity ?? null,
        },
      });
    } else {
      return NextResponse.json({ error: 'car_required' }, { status: 400 });
    }

    // Price snapshot from the Price table.
    const price = await prisma.price.findUnique({ where: { fuelType: data.fuelType } });
    if (!price) return NextResponse.json({ error: 'Price unavailable' }, { status: 400 });

    // Resolve liters. Full tank requires a known tank capacity.
    const isFullTank = data.isFullTank ?? false;
    let liters: number;
    if (isFullTank) {
      if (!car.tankCapacity) {
        return NextResponse.json({ error: 'tank_capacity_unknown' }, { status: 400 });
      }
      liters = car.tankCapacity;
    } else {
      liters = data.volume ?? 0;
      if (liters < B2C_MIN_ORDER_LITERS) {
        return NextResponse.json({ error: 'min_volume' }, { status: 400 });
      }
    }

    const totalAmount = price.priceUzs * liters;

    const order = await prisma.order.create({
      data: {
        clientId: user.id,
        clientCarId: car.id,
        carId: null,
        fuelType: data.fuelType,
        volume: liters,
        isFullTank,
        lat: data.lat,
        lng: data.lng,
        address: data.address || null,
        pricePerLiter: price.priceUzs,
        totalAmount,
        // PR-A: card-to-courier only. Online (Payme) arrives in PR-B.
        paymentMethod: 'COURIER_POS',
        paymentStatus: 'NOT_REQUIRED',
        status: 'RECEIVED',
      },
    });

    // Geo-dispatch to the nearest available couriers; the stale-order cron backs
    // this up with a broadcast if nobody has a fresh location.
    await dispatchB2COrderToNearest(order.id);

    return NextResponse.json({ id: order.id, status: order.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message || 'Invalid data' },
        { status: 400 },
      );
    }
    console.error('[orders/client POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
