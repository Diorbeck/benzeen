import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  carIds: z.array(z.string().min(1)).optional(),
});

async function getCompanyDriver(id: string, companyId: string | null | undefined, role: string | undefined) {
  const where =
    role === 'SUPER_ADMIN'
      ? { id, role: 'DRIVER' as const }
      : { id, role: 'DRIVER' as const, companyId: companyId ?? undefined };
  return prisma.user.findFirst({ where, include: { driverCars: true } });
}

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
    const data = patchSchema.parse(await req.json());

    const driver = await getCompanyDriver(id, companyId, role);
    if (!driver) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (data.name !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { name: data.name.trim() },
      });
    }

    if (data.carIds !== undefined) {
      const scopeCompanyId = role === 'SUPER_ADMIN' ? driver.companyId : companyId;
      const cars = await prisma.car.findMany({
        where: { id: { in: data.carIds }, companyId: scopeCompanyId ?? undefined },
        select: { id: true },
      });
      const validIds = new Set(cars.map((c) => c.id));
      if (validIds.size !== data.carIds.length) {
        return NextResponse.json(
          { error: 'One or more cars are invalid' },
          { status: 400 }
        );
      }

      const current = new Set(driver.driverCars.map((dc) => dc.carId));
      const toAdd = [...validIds].filter((cid) => !current.has(cid));
      const toRemove = [...current].filter((cid) => !validIds.has(cid));

      await prisma.$transaction([
        ...(toRemove.length
          ? [
              prisma.driverCar.deleteMany({
                where: { driverId: id, carId: { in: toRemove } },
              }),
            ]
          : []),
        ...toAdd.map((cid) =>
          prisma.driverCar.create({ data: { driverId: id, carId: cid } })
        ),
      ]);
    }

    return NextResponse.json({ ok: true });
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

export async function DELETE(
  _req: Request,
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
    const driver = await getCompanyDriver(id, companyId, role);
    if (!driver) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
