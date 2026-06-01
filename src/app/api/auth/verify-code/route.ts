import { NextResponse } from 'next/server';
import { z } from 'zod';
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

    // Self-service signup is disabled — accounts are created by an admin only.
    // Only password_reset reaches this point.
    if (data.purpose === 'signup') {
      return NextResponse.json(
        { error: 'Self-service signup is disabled.' },
        { status: 403 }
      );
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
