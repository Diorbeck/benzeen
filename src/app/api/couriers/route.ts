import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { getMiniAppUrl } from '@/lib/telegram';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const schema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  // Optional: when omitted the server generates a temporary password and returns
  // it once so the admin can relay it to the courier ("Передай курьеру").
  password: z.string().min(6).max(64).optional(),
  vehicleNumber: z.string().max(50).optional(),
});

/**
 * Generates a readable temporary password: 10 chars from an unambiguous
 * alphabet (no 0/O/1/I/l). Used when the admin doesn't supply one.
 */
function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, id: actorId, email: actorEmail } = session.user as {
      role?: string;
      id?: string;
      email?: string;
    };
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

    // Use the admin-supplied password, or mint a temporary one to hand off.
    const tempPassword = data.password ?? generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
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

    await writeAuditLog({
      action: 'COURIER_CREATE',
      targetType: 'Courier',
      targetId: courier.id,
      actorId: actorId ?? null,
      actorEmail: actorEmail ?? null,
      // Name only — never store phone/email (PII) in the audit trail.
      metadata: { name: courier.name },
    });

    // Hand-off block ("Передай курьеру"): the login (phone), the temporary
    // password (returned exactly once — never stored in plaintext), and the bot
    // link the courier opens to link their Telegram + start a shift.
    return NextResponse.json({
      id: courier.id,
      login: courier.phone,
      tempPassword,
      botLink: getMiniAppUrl(),
    });
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
