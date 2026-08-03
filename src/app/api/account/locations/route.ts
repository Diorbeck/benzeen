import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MAX_SAVED_LOCATIONS } from '@/lib/constants';

const locationSchema = z.object({
  name: z.string().trim().min(1).max(40),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

async function requireClient() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'CLIENT') return null;
  return user.id;
}

export async function GET() {
  const userId = await requireClient();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const locations = await prisma.savedLocation.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, lat: true, lng: true },
  });
  return NextResponse.json(locations);
}

export async function POST(req: Request) {
  const userId = await requireClient();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { name, lat, lng } = locationSchema.parse(await req.json());
    // Enforce the 3-address cap server-side.
    const count = await prisma.savedLocation.count({ where: { userId } });
    if (count >= MAX_SAVED_LOCATIONS) {
      return NextResponse.json({ error: 'limit_reached' }, { status: 400 });
    }
    const loc = await prisma.savedLocation.create({
      data: { userId, name, lat, lng },
      select: { id: true, name: true, lat: true, lng: true },
    });
    return NextResponse.json(loc);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    console.error('[account/locations POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
