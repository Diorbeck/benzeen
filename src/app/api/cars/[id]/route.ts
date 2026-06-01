import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchSchema = z
  .object({
    monthlyLimit: z.number().int().min(1).max(10000).optional(),
    model: z.string().max(100).nullable().optional(),
    plateNumber: z.string().min(1).max(20).optional(),
  })
  .refine(
    (d) =>
      d.monthlyLimit !== undefined ||
      d.model !== undefined ||
      d.plateNumber !== undefined,
    { message: 'Nothing to update' }
  );

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    const companyId = (session.user as { companyId?: string | null }).companyId;
    if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const data = patchSchema.parse(body);

    const car = await prisma.car.findUnique({ where: { id } });
    if (!car) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (role === 'COMPANY_ADMIN' && car.companyId !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: {
      monthlyLimit?: number;
      model?: string | null;
      plateNumber?: string;
    } = {};

    if (data.monthlyLimit !== undefined) {
      const now = new Date();
      const usage = await prisma.carUsage.findUnique({
        where: {
          carId_month_year: {
            carId: id,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          },
        },
      });
      const used = usage?.usedLiters ?? 0;
      if (data.monthlyLimit < used) {
        return NextResponse.json(
          { error: 'LIMIT_BELOW_USED', minimum: used },
          { status: 400 }
        );
      }
      updateData.monthlyLimit = data.monthlyLimit;
    }

    if (data.model !== undefined) {
      const trimmed = data.model?.trim();
      updateData.model = trimmed ? trimmed : null;
    }

    if (data.plateNumber !== undefined) {
      const plate = data.plateNumber.trim().toUpperCase();
      if (!plate) {
        return NextResponse.json({ error: 'Invalid plate' }, { status: 400 });
      }
      const dup = await prisma.car.findFirst({
        where: { companyId: car.companyId, plateNumber: plate, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json(
          { error: 'PLATE_EXISTS' },
          { status: 400 }
        );
      }
      updateData.plateNumber = plate;
    }

    const updated = await prisma.car.update({
      where: { id },
      data: updateData,
    });

    if (
      data.monthlyLimit !== undefined &&
      data.monthlyLimit !== car.monthlyLimit
    ) {
      const actor = session.user as { id?: string; email?: string };
      await writeAuditLog({
        action: 'LIMIT_CHANGE',
        targetType: 'Car',
        targetId: id,
        actorId: actor.id ?? null,
        actorEmail: actor.email ?? null,
        metadata: {
          plateNumber: car.plateNumber,
          before: car.monthlyLimit,
          after: data.monthlyLimit,
        },
      });
    }

    return NextResponse.json(updated);
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
