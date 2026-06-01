import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';

const patchSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  vehicleNumber: z.string().max(50).optional(),
  password: z.string().min(6).max(64).optional(),
});

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized', status: 401 as const };
  const { role, id, email } = session.user as {
    role?: string;
    id?: string;
    email?: string;
  };
  if (role !== 'SUPER_ADMIN') return { error: 'Forbidden', status: 403 as const };
  return { ok: true as const, actorId: id ?? null, actorEmail: email ?? null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireSuperAdmin();
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const { id } = await params;

    const courier = await prisma.user.findFirst({ where: { id, role: 'COURIER' } });
    if (!courier) {
      return NextResponse.json({ error: 'Курьер не найден' }, { status: 404 });
    }

    const data = patchSchema.parse(await req.json());
    const phone = data.phone.trim().replace(/\s/g, '');

    const dup = await prisma.user.findFirst({
      where: { phone, id: { not: id } },
    });
    if (dup) {
      return NextResponse.json(
        { error: 'Этот номер телефона уже зарегистрирован' },
        { status: 400 },
      );
    }

    const updateData: {
      name: string;
      phone: string;
      vehicleNumber: string | null;
      passwordHash?: string;
    } = {
      name: data.name.trim(),
      phone,
      vehicleNumber: data.vehicleNumber?.trim() || null,
    };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    await prisma.user.update({ where: { id }, data: updateData });
    return NextResponse.json({ ok: true });
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireSuperAdmin();
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const { id } = await params;
    const courier = await prisma.user.findFirst({ where: { id, role: 'COURIER' } });
    if (!courier) {
      return NextResponse.json({ error: 'Курьер не найден' }, { status: 404 });
    }
    await prisma.user.delete({ where: { id } });
    await writeAuditLog({
      action: 'COURIER_DELETE',
      targetType: 'Courier',
      targetId: id,
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
      metadata: { name: courier.name },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
