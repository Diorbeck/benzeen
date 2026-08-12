import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ text: z.string().trim().min(1).max(2000) });

// Ответ админа в тред (у клиента подпись «Оператор»). Снимает «нужен человек»,
// статус → ANSWERED; действие в AuditLog.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
    return NextResponse.json({ error: 'closed' }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: id, authorType: 'ADMIN', text: parsed.data.text },
    }),
    prisma.supportTicket.update({
      where: { id },
      data: { status: 'ANSWERED', needsHuman: false },
    }),
  ]);

  await writeAuditLog({
    action: 'SUPPORT_REPLY',
    targetType: 'SupportTicket',
    targetId: id,
    actorId: guard.actorId,
    actorEmail: guard.actorEmail,
  });

  return NextResponse.json({ ok: true });
}
