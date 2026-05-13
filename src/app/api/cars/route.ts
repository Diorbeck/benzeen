import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  plateNumber: z.string().min(1).max(20),
  model: z.string().max(100).optional(),
  fuelType: z.enum(['AI_92', 'AI_95']),
  monthlyLimit: z.coerce.number().int().min(1).max(10000),
  tankCapacity: z.coerce.number().int().min(1).max(80),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = (session.user as { companyId?: string | null }).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company' }, { status: 403 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = schema.parse(body);

    const existing = await prisma.car.findFirst({
      where: {
        companyId,
        plateNumber: data.plateNumber.toUpperCase(),
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Машина с таким номером уже есть' },
        { status: 400 }
      );
    }

    const car = await prisma.car.create({
      data: {
        companyId,
        plateNumber: data.plateNumber.toUpperCase(),
        model: data.model,
        fuelType: data.fuelType as 'AI_92' | 'AI_95',
        monthlyLimit: data.monthlyLimit,
        tankCapacity: data.tankCapacity,
      },
    });

    return NextResponse.json(car);
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
