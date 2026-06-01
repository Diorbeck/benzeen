import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';

const schema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  password: z.string().min(6).max(64),
  vehicleNumber: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as { role?: string };
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = schema.parse(await req.json());

    const phone = data.phone.trim().replace(/\s/g, '');
    if (!phone) {
      return NextResponse.json({ error: 'Введите номер телефона' }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        { error: 'Этот номер телефона уже зарегистрирован' },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const sanitized = phone.replace(/\D/g, '');
    const email = `courier+${sanitized}@benzeen.local`;

    const courier = await prisma.user.create({
      data: {
        email,
        name: data.name.trim(),
        phone,
        passwordHash,
        vehicleNumber: data.vehicleNumber?.trim() || null,
        role: 'COURIER',
      },
    });

    return NextResponse.json({ id: courier.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message || 'Invalid data' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
