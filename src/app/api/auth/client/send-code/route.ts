import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndSendCode } from '@/lib/verification';

// Client (B2C) sign-in / sign-up: send a 6-digit SMS code to an Uzbek number.
// The account is created (role CLIENT) only after the code is verified during
// NextAuth sign-in, so this endpoint never creates users on its own.
const sendSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s()-]/g, ''))
    .refine((s) => /^\+998\d{9}$/.test(s), 'invalid_phone'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = sendSchema.parse(body);

    const result = await createAndSendCode({
      identifier: phone,
      method: 'phone',
      purpose: 'client_auth',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }
    console.error('[client/send-code]', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    const message =
      process.env.NODE_ENV === 'development'
        ? errMsg
        : 'Service temporarily unavailable. Try again later.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
