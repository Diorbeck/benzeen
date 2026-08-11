import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

// Закрыть диалог. Клиент видит системное «Обращение закрыто» (рендер по
// статусу CLOSED) и может только читать + открыть новое обращение.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
    return NextResponse.json({ error: 'already_closed' }, { status: 409 });
  }

  await prisma.supportTicket.update({
    where: { id },
    data: { status: 'CLOSED', needsHuman: false },
  });

  await writeAuditLog({
    action: 'SUPPORT_CLOSE',
    targetType: 'SupportTicket',
    targetId: id,
    actorId: guard.actorId,
    actorEmail: guard.actorEmail,
  });

  return NextResponse.json({ ok: true });
}
