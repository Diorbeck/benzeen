import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAndSendCode } from '@/lib/verification';

const sendSchema = z.object({
  identifier: z.string().min(1),
  method: z.enum(['email', 'phone']),
  purpose: z.enum(['signup', 'password_reset']),
  signupPayload: z
    .object({
      fullName: z.string().min(1),
      companyName: z.string().min(1),
      email: z.string().email(),
      phone: z.string(),
      password: z.string().min(8),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = sendSchema.parse(body);

    // Self-service signup is disabled — accounts are created by an admin only.
    // Only password_reset is allowed past this point.
    if (data.purpose === 'signup') {
      return NextResponse.json(
        { error: 'Self-service signup is disabled.' },
        { status: 403 }
      );
    }

    const result = await createAndSendCode({
      identifier: data.identifier,
      method: data.method,
      purpose: data.purpose,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten().fieldErrors }, { status: 400 });
    }
    console.error('[send-verification-code]', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : null;
    let message = 'Service temporarily unavailable. Try again later.';
    if (process.env.NODE_ENV === 'development') {
      if (code === 'P1001' || errMsg.includes("Can't reach database server")) {
        message = 'Database is not running. Run in terminal: docker compose up -d && sleep 5 && npx prisma db push';
      } else if (code === 'P2021' || errMsg.includes('does not exist')) {
        message = 'Verification table missing. Run: npx prisma db push';
      } else {
        message = errMsg;
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
