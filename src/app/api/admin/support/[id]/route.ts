import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

// Mark a support ticket RESOLVED. SUPER_ADMIN only; audited.
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
