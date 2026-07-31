import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  B2C_MIN_ORDER_LITERS,
  FULL_TANK_MAX_LITERS,
  SCHEDULE_MIN_LEAD_MS,
  SCHEDULE_MAX_AHEAD_MS,
} from '@/lib/constants';
import { dispatchB2COrderToNearest, redispatchStale } from '@/lib/order-dispatch';
import { paymeCheckoutUrl } from '@/lib/payme';

const schema = z
  .object({
    fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']),
    volume: z.number().int().positive().max(FULL_TANK_MAX_LITERS).optional(),
    isFullTank: z.boolean().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().max(500).optional(),
    // 'PAYME' is only honored when Payme is configured; otherwise card-to-courier.
    paymentMethod: z.enum(['COURIER_POS', 'PAYME']).optional(),
    // ISO datetime for a planned order; absent = deliver ASAP.
    scheduledFor: z.string().datetime().optional(),
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

    // Scheduled order? Validate the window server-side (24/7, +1h … +7d).
    let scheduledFor: Date | null = null;
    if (data.scheduledFor) {
      const dt = new Date(data.scheduledFor);
      const now = Date.now();
      const SLACK = 60 * 1000;
      if (
        Number.isNaN(dt.getTime()) ||
        dt.getTime() < now + SCHEDULE_MIN_LEAD_MS - SLACK ||
        dt.getTime() > now + SCHEDULE_MAX_AHEAD_MS + SLACK
      ) {
        return NextResponse.json({ error: 'invalid_schedule' }, { status: 400 });
      }
      scheduledFor = dt;
    }
    const scheduled = scheduledFor != null;

    // Online payment (Payme) only when configured; not for scheduled v1.
    const merchantId = process.env.PAYME_MERCHANT_ID;
    const payOnline = !scheduled && data.paymentMethod === 'PAYME' && !!merchantId;

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
        scheduledFor,
        // Scheduled: SCHEDULED + POS, NOT dispatched until its window opens.
        // Online: PENDING + CREATED until PAID. POS: NOT_REQUIRED + RECEIVED, live now.
        paymentMethod: payOnline ? 'PAYME' : 'COURIER_POS',
        paymentStatus: payOnline ? 'PENDING' : 'NOT_REQUIRED',
        status: scheduled ? 'SCHEDULED' : payOnline ? 'CREATED' : 'RECEIVED',
      },
    });

    // Activity sweep for OTHER orders (activates due-soon scheduled + stale RECEIVED).
    await redispatchStale();

    if (scheduled) {
      // Not dispatched now; activated by redispatchStale when its window opens.
      return NextResponse.json({ id: order.id, status: order.status });
    }

    if (payOnline) {
      return NextResponse.json({
        id: order.id,
        status: order.status,
        checkoutUrl: paymeCheckoutUrl(merchantId!, order.id, totalAmount * 100),
      });
    }

    // Card-to-courier: geo-dispatch now; redispatchStale + daily cron are the fallback.
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
