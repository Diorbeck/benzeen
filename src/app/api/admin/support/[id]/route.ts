import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

// Тред обращения для админа (Поддержка 2.0).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      needsHuman: true,
      createdAt: true,
      user: { select: { name: true, phone: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorType: true, text: true, createdAt: true },
      },
    },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ticket });
}

// Mark a support ticket RESOLVED. SUPER_ADMIN only; audited. (legacy)
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    await prisma.supportTicket.update({ where: { id }, data: { status: 'RESOLVED' } });

    await writeAuditLog({
      action: 'SUPPORT_RESOLVE',
      targetType: 'SupportTicket',
      targetId: id,
      actorId: guard.actorId,
      actorEmail: guard.actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/support PATCH]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
