import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const carSchema = z.object({
  plate: z.string().trim().min(1).max(20),
  model: z.string().trim().max(60).optional(),
  tankCapacity: z.number().int().min(20).max(200).optional(),
});

async function requireClient() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') return null;
  return user.id;
}

// List the signed-in client's own cars.
export async function GET() {
  const userId = await requireClient();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const cars = await prisma.clientCar.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, plate: true, model: true, tankCapacity: true },
  });
  return NextResponse.json(cars);
}

// Add a car to the signed-in client.
export async function POST(req: Request) {
  const userId = await requireClient();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { plate, model, tankCapacity } = carSchema.parse(await req.json());
    const car = await prisma.clientCar.create({
      data: { userId, plate, model: model || null, tankCapacity: tankCapacity ?? null },
      select: { id: true, plate: true, model: true, tankCapacity: true },
    });
    return NextResponse.json(car);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    console.error('[account/cars POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
