'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';
import { getStoredRef, clearStoredRef } from '@/lib/referral-client';

function normalizePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, '');
}

function ClientLoginForm() {
  const t = useTranslations('clientLogin');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';
  const callbackUrl = searchParams?.get('callbackUrl') || `/${locale}/account`;

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+998');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const normalized = normalizePhone(phone);
    if (!/^\+998\d{9}$/.test(normalized)) {
      setError(t('errors.invalidPhone'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/client/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      if (!res.ok) {
        // Rate limited by the auth middleware → distinct "slow down" message
        // so the user knows to wait rather than think SMS is broken.
        if (res.status === 429) {
          setError(t('errors.rateLimited'));
          return;
        }
        const data = await res.json().catch(() => null);
        // Bad number → field error; anything else (Eskiz/gateway) → honest
        // "SMS temporarily unavailable" instead of a vague generic error.
        setError(
          data?.error === 'invalid_phone'
            ? t('errors.invalidPhone')
            : t('errors.smsUnavailable'),
        );
        return;
      }
      setPhone(normalized);
      setStep('code');
      setInfo(t('devHint'));
    } catch {
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError(t('errors.invalidCode'));
      return;
    }
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        identifier: normalizePhone(phone),
        password: digits,
        mode: 'client',
        ref: getStoredRef(),
        redirect: false,
      });
      if (res?.error) {
        setError(t('errors.invalidCode'));
        return;
      }
      clearStoredRef();
      router.push(callbackUrl as string);
      router.refresh();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('title')}
      subtitle={step === 'phone' ? t('subtitle') : t('subtitleCode', { phone })}
      backHref={`/${locale}`}
      backLabel={t('backToHome')}
    >
      {error && (
        <p className="mb-4 rounded-control bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {info && !error && (
        <p className="mb-4 rounded-control bg-gray-100 dark:bg-white/10 px-4 py-3 text-sm text-navy dark:text-white" role="status">
          {info}
        </p>
      )}

      {step === 'phone' ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label htmlFor="client-phone" className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('phoneLabel')}
            </label>
            <input
              id="client-phone"
              type="tel"
              inputMode="tel"
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className={inputClass}
              autoComplete="tel"
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('sending') : t('sendCode')}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <div>
            <label htmlFor="client-code" className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('codeLabel')}
            </label>
            <input
              id="client-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder={t('codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className={`${inputClass} text-center text-lg tracking-[0.5em]`}
              autoComplete="one-time-code"
              disabled={loading}
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('verifying') : t('verify')}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError('');
              setInfo('');
            }}
            className="min-h-11 w-full rounded-control text-center text-sm font-medium text-gray-500 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60"
            disabled={loading}
          >
            {t('changePhone')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

function ClientLoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent dark:border-primary-400 dark:border-t-transparent" />
    </div>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<ClientLoginFallback />}>
      <ClientLoginForm />
    </Suspense>
  );
}
