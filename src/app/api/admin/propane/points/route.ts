import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// Points with today's queue — read by the admin CRUD AND the operator screen.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== 'SUPER_ADMIN' && user.role !== 'PROPANE_OPERATOR')) {
    return NextResponse.json({ error: 'forbidden' }, { status: user?.id ? 403 : 401 });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  // Operators only see the points bound to them; admins see everything.
  const scope = user.role === 'PROPANE_OPERATOR' ? { operatorId: user.id } : {};
  const points = await prisma.propanePoint.findMany({
    where: scope,
    orderBy: { createdAt: 'asc' },
    include: {
      bookings: {
        where: { slotStart: { gte: dayStart } },
        orderBy: { slotStart: 'asc' },
        select: {
          id: true,
          slotStart: true,
          status: true,
          code: true,
          client: { select: { name: true, phone: true } },
        },
      },
    },
  });
  return NextResponse.json({ points });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  priceUzs: z.number().int().positive().max(1_000_000),
  postsCount: z.number().int().min(1).max(20),
  operatorId: z.string().cuid().nullable().optional(),
});

export async function POST(req: Request) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const point = await prisma.propanePoint.create({ data: parsed.data });
  return NextResponse.json({ point }, { status: 201 });
}
