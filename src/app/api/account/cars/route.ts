import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentClient } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const carSelect = {
  id: true,
  plate: true,
  model: true,
  tankCapacity: true,
  brand: true,
  color: true,
  fuelType: true,
  oilType: true,
  photoUrl: true,
} as const;

const carSchema = z.object({
  plate: z.string().trim().min(1).max(20),
  model: z.string().trim().max(60).optional(),
  tankCapacity: z.number().int().min(20).max(200).optional(),
  brand: z.string().trim().max(60).optional(),
  color: z.string().trim().max(40).optional(),
  fuelType: z.enum(['AI_92', 'AI_95', 'AI_100']).optional(),
  oilType: z.string().trim().max(60).optional(),
  photoUrl: z.string().url().max(2048).optional(),
});

// List the signed-in client's own cars.
export async function GET() {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const cars = await prisma.clientCar.findMany({
    where: { userId: client.id },
    orderBy: { createdAt: 'desc' },
    select: carSelect,
  });
  return NextResponse.json(cars);
}

// Add a car to the signed-in client.
export async function POST(req: Request) {
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const p = carSchema.parse(await req.json());
    const car = await prisma.clientCar.create({
      data: {
        userId: client.id,
        plate: p.plate,
        model: p.model || null,
        tankCapacity: p.tankCapacity ?? null,
        brand: p.brand || null,
        color: p.color || null,
        fuelType: p.fuelType ?? null,
        oilType: p.oilType || null,
        photoUrl: p.photoUrl || null,
      },
      select: carSelect,
    });
    return NextResponse.json(car);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    console.error('[account/cars POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
