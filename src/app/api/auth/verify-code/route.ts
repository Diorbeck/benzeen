import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyCode } from '@/lib/verification';

const verifySchema = z.object({
  identifier: z.string().min(1),
  code: z.string().refine((s) => s.replace(/\D/g, '').length === 6, 'Code must be 6 digits'),
  purpose: z.enum(['signup', 'password_reset']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = verifySchema.parse(body);

    const result = await verifyCode({
      identifier: data.identifier,
      code: data.code,
      purpose: data.purpose,
    });

    if (!result.ok) {
      const message =
        result.error === 'invalid_code'
          ? 'Invalid or expired code. Please request a new one.'
          : result.error;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (data.purpose === 'signup' && result.signupMeta) {
      const { fullName, companyName, email, phone, passwordHash } = result.signupMeta;
      const emailNormalized = String(email ?? '').trim().toLowerCase();
      if (!emailNormalized || !passwordHash) {
        return NextResponse.json({ error: 'Invalid signup data' }, { status: 400 });
      }
      const existing = await prisma.user.findUnique({ where: { email: emailNormalized } });
      if (existing) {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 400 });
      }
      const company = await prisma.company.create({
        data: {
          name: (companyName ?? '').trim(),
          phone: phone ? String(phone).trim() || undefined : undefined,
        },
      });
      await prisma.user.create({
        data: {
          email: emailNormalized,
          name: (fullName ?? '').trim() || null,
          phone: phone ? String(phone).trim() || undefined : undefined,
          passwordHash,
          role: 'COMPANY_ADMIN',
          companyId: company.id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten().fieldErrors }, { status: 400 });
    }
    console.error('[verify-code]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
