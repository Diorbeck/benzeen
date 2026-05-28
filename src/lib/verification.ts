import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const CODE_EXPIRY_MINUTES = 15;
const DIGITS = 6;

function generateCode(): string {
  let s = '';
  for (let i = 0; i < DIGITS; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

export type VerificationPurpose = 'signup' | 'password_reset';

export type SignupMeta = {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  passwordHash: string;
};

export async function createAndSendCode(params: {
  identifier: string;
  method: 'email' | 'phone';
  purpose: VerificationPurpose;
  meta?: SignupMeta;
}): Promise<{ ok: true; expiresAt: Date } | { ok: false; error: string }> {
  const { identifier, method, purpose, meta } = params;
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
  const normalized =
    method === 'email' ? identifier.trim().toLowerCase() : identifier.trim();

  await prisma.verificationCode.create({
    data: {
      identifier: normalized,
      code,
      purpose,
      meta: meta ? (meta as object) : undefined,
      expiresAt,
    },
  });

  if (method === 'email') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Verification] RESEND_API_KEY not set. Code for', identifier, ':', code);
        return { ok: true, expiresAt };
      }
      return { ok: false, error: 'Email sending not configured' };
    }
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const subject =
      purpose === 'signup'
        ? 'Your Benzeen verification code'
        : 'Your Benzeen password reset code';
    const text = `Your verification code is: ${code}\n\nIt expires in ${CODE_EXPIRY_MINUTES} minutes.`;
    const { error } = await resend.emails.send({
      from,
      to: identifier.trim(),
      subject,
      text,
    });
    if (error) {
      console.error('[Verification] Resend error:', error);
      let msg = error.message || 'Failed to send email';
      if (msg.includes('own email') || msg.includes('verify') || msg.includes('domain')) {
        msg += ' To send to any email: verify your domain at https://resend.com/domains and set RESEND_FROM_EMAIL to an address on that domain (e.g. noreply@yourdomain.com).';
      }
      return { ok: false, error: msg };
    }
    return { ok: true, expiresAt };
  }

  // method === 'phone' (SMS)
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (sid && token && fromNumber) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(sid, token);
      await client.messages.create({
        body: `Benzeen: Your verification code is ${code}. Valid for ${CODE_EXPIRY_MINUTES} minutes.`,
        from: fromNumber,
        to: identifier.trim(),
      });
      return { ok: true, expiresAt };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Verification] Twilio error:', msg);
      return { ok: false, error: msg || 'Failed to send SMS' };
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Verification] SMS not configured. Code for', identifier, ':', code);
    return { ok: true, expiresAt };
  }
  return {
    ok: false,
    error:
      'SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env and run: npm install twilio',
  };
}

export async function verifyCode(params: {
  identifier: string;
  code: string;
  purpose: VerificationPurpose;
}): Promise<
  | { ok: true; signupMeta?: SignupMeta }
  | { ok: false; error: string }
> {
  const { identifier, code: rawCode, purpose } = params;
  const code = rawCode.replace(/\D/g, '').slice(0, DIGITS);
  if (code.length !== DIGITS) {
    return { ok: false, error: 'invalid_code' };
  }

  const normalized = identifier.includes('@')
    ? identifier.trim().toLowerCase()
    : identifier.trim();
  const record = await prisma.verificationCode.findFirst({
    where: {
      identifier: normalized,
      code,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return { ok: false, error: 'invalid_code' };
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const signupMeta = purpose === 'signup' && record.meta ? (record.meta as SignupMeta) : undefined;
  return { ok: true, signupMeta };
}
