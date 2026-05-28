import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  name: z.string().max(200).optional(),
  phone: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
  carId: z.string().min(1),
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

    const phone = data.phone.trim().replace(/\s/g, '');
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone is required' },
        { status: 400 }
      );
    }

    const car = await prisma.car.findFirst({
      where: { id: data.carId, companyId },
    });
    if (!car) {
      return NextResponse.json(
        { error: 'Car not found or not in your company' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { phone },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Phone number already registered' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const sanitized = phone.replace(/\D/g, '');
    const driverEmail = `driver+${sanitized}@benzeen.local`;

    const user = await prisma.user.create({
      data: {
        email: driverEmail,
        name: data.name?.trim() || null,
        phone,
        passwordHash,
        role: 'DRIVER',
        companyId,
      },
    });

    await prisma.driverCar.create({
      data: {
        driverId: user.id,
        carId: car.id,
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
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
