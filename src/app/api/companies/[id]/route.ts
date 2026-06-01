import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
  telegram: z.string().max(100).optional(),
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
    const data = patchSchema.parse(await req.json());

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        telegram: data.telegram?.trim() || null,
      },
    });

    return NextResponse.json({ id: company.id });
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
    const existing = await prisma.company.findUnique({
      where: { id },
      select: { name: true },
    });
    await prisma.company.delete({ where: { id } });
    await writeAuditLog({
      action: 'COMPANY_DELETE',
      targetType: 'Company',
      targetId: id,
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
      metadata: existing ? { name: existing.name } : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
