import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
  telegram: z.string().max(100).optional(),
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

    const body = await req.json();
    const data = schema.parse(body);

    const company = await prisma.company.create({
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        telegram: data.telegram,
      },
    });

    return NextResponse.json(company);
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

const patchSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
  telegram: z.string().max(100).optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, companyId } = session.user as {
      role?: string;
      companyId?: string | null;
    };
    if (role !== 'COMPANY_ADMIN' || !companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = patchSchema.parse(await req.json());

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        telegram: data.telegram?.trim() || null,
      },
    });

    return NextResponse.json(company);
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

