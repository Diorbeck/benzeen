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

export type VerificationPurpose = 'signup' | 'password_reset' | 'client_auth';

// --- Eskiz.uz SMS gateway ---------------------------------------------------
// Auth (email/password) returns a bearer token (valid ~30 days); we cache it in
// module memory and refresh on 401. Replaces the old Twilio integration.
const ESKIZ_BASE = 'https://notify.eskiz.uz/api';
const ESKIZ_TOKEN_TTL_MS = 20 * 24 * 60 * 60 * 1000; // refresh well before 30d

let eskizToken: { token: string; fetchedAt: number } | null = null;

async function getEskizToken(email: string, password: string): Promise<string> {
  const now = Date.now();
  if (eskizToken && now - eskizToken.fetchedAt < ESKIZ_TOKEN_TTL_MS) {
    return eskizToken.token;
  }
  const body = new URLSearchParams({ email, password });
  const res = await fetch(`${ESKIZ_BASE}/auth/login`, { method: 'POST', body });
  const json = (await res.json().catch(() => null)) as
    | { data?: { token?: string }; message?: string }
    | null;
  const token = json?.data?.token;
  if (!res.ok || !token) {
    throw new Error(`Eskiz auth failed (${res.status}): ${json?.message ?? 'no token'}`);
  }
  eskizToken = { token, fetchedAt: now };
  return token;
}

async function sendEskizSms(params: {
  email: string;
  password: string;
  to: string;
  message: string;
}): Promise<void> {
  const { email, password, to, message } = params;
  const mobile = to.replace(/\D/g, ''); // Eskiz expects digits, e.g. 998901234567
  const from = process.env.ESKIZ_FROM || '4546';

  const send = async (token: string) => {
    const form = new URLSearchParams();
    form.set('mobile_phone', mobile);
    form.set('message', message);
    form.set('from', from);
    return fetch(`${ESKIZ_BASE}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  };

  let token = await getEskizToken(email, password);
  let res = await send(token);
  if (res.status === 401) {
    // Token expired/revoked — force a refresh and retry once.
    eskizToken = null;
    token = await getEskizToken(email, password);
    res = await send(token);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Eskiz send failed (${res.status}): ${text}`);
  }
}

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

  // method === 'phone' (SMS via Eskiz.uz)
  const eskizEmail = process.env.ESKIZ_EMAIL;
  const eskizPassword = process.env.ESKIZ_PASSWORD;

  if (eskizEmail && eskizPassword) {
    try {
      await sendEskizSms({
        email: eskizEmail,
        password: eskizPassword,
        to: identifier.trim(),
        message: `Код подтверждения для регистрации на сайте benzeen.uz: ${code}`,
      });
      return { ok: true, expiresAt };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Verification] Eskiz error:', msg);
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
      'SMS not configured. Set ESKIZ_EMAIL and ESKIZ_PASSWORD in .env (Eskiz.uz).',
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
