import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';
import { FULL_TANK_MAX_LITERS } from '@/lib/constants';

const schema = z.object({
  carId: z.string().cuid(),
  fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']),
  volume: z.number().int().min(0).max(FULL_TANK_MAX_LITERS),
  isFullTank: z.boolean().optional(),
  address: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = schema.parse(body);

    const car = await prisma.car.findUnique({
      where: { id: data.carId },
      include: { usage: true, company: true },
    });

    if (!car) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }

    const role = (session.user as { role?: string }).role;
    const companyId = (session.user as { companyId?: string | null }).companyId;

    if (role === 'DRIVER') {
      const assigned = await prisma.driverCar.findUnique({
        where: {
          driverId_carId: {
            driverId: session.user.id,
            carId: data.carId,
          },
        },
      });
      if (!assigned) {
        return NextResponse.json({ error: 'Car not assigned to you' }, { status: 403 });
      }
    } else if (role === 'COMPANY_ADMIN') {
      if (car.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isFullTank = data.isFullTank ?? false;
    const volume = data.volume ?? 0;

    const order = await prisma.order.create({
      data: {
        carId: data.carId,
        fuelType: data.fuelType,
        volume,
        isFullTank,
        status: 'CREATED',
        address: data.address ?? undefined,
        notes: data.notes ?? undefined,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(order);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
