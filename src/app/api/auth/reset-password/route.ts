import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyCode } from '@/lib/verification';

const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().refine((s) => s.replace(/\D/g, '').length === 6, 'Code must be 6 digits'),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = resetSchema.parse(body);

    const result = await verifyCode({
      identifier: data.email.trim().toLowerCase(),
      code: data.code,
      purpose: 'password_reset',
    });

    if (!result.ok) {
      const message =
        result.error === 'invalid_code'
          ? 'Invalid or expired code. Please request a new one.'
          : result.error;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.updateMany({
      where: { email: data.email.trim().toLowerCase() },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten().fieldErrors }, { status: 400 });
    }
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
