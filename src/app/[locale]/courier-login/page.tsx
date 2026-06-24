'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

function CourierLoginForm() {
  const t = useTranslations('courierLogin');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';
  const callbackUrl = searchParams?.get('callbackUrl') || `/${locale}/dashboard`;

  // 'sms' is the primary flow; 'password' is the fallback.
  const [authMode, setAuthMode] = useState<'sms' | 'password'>('sms');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!phone.trim()) {
      setError(t('errorPhoneCode'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: phone.trim(),
          method: 'phone',
          purpose: 'login',
        }),
      });
      if (!res.ok) {
        setError(t('errorCode'));
        return;
      }
      setCodeSent(true);
      setInfo(t('codeSent'));
    } catch {
      setError(t('errorCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleSmsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !code.trim()) {
      setError(t('errorPhoneCode'));
      return;
    }
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        identifier: phone.trim(),
        password: code.trim(),
        mode: 'courier',
        otp: 'true',
        redirect: false,
      });
      if (res?.error) {
        setError(t('errorCode'));
        return;
      }
      router.push(callbackUrl as string);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !password.trim()) {
      setError(t('errorPhonePassword'));
      return;
    }
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        identifier: phone.trim(),
        password,
        mode: 'courier',
        redirect: false,
      });
      if (res?.error) {
        setError(tAuth('errors.invalidEmailPassword'));
        return;
      }
      router.push(callbackUrl as string);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('title')} subtitle={t('subtitle')}>
      <form
        onSubmit={
          authMode === 'password'
            ? handlePasswordLogin
            : codeSent
            ? handleSmsLogin
            : handleSendCode
        }
        className="space-y-4"
      >
        {error && (
          <p
            className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {info && !error && (
          <p
            className="rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400"
            role="status"
          >
            {info}
          </p>
        )}

        <div>
          <label htmlFor="courier-phone" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('phoneNumber')}
          </label>
          <input
            id="courier-phone"
            type="tel"
            placeholder="+998 90 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className={inputClass}
            autoComplete="tel"
            disabled={loading}
          />
        </div>

        {authMode === 'sms' && codeSent && (
          <div>
            <label htmlFor="courier-code" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('code')}
            </label>
            <input
              id="courier-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className={inputClass}
              disabled={loading}
            />
          </div>
        )}

        {authMode === 'password' && (
          <div>
            <label htmlFor="courier-password" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('password')}
            </label>
            <input
              id="courier-password"
              type="password"
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? t('submitting')
            : authMode === 'password'
            ? t('submit')
            : codeSent
            ? t('submit')
            : t('sendCode')}
        </Button>

        <div className="text-center">
          {authMode === 'sms' ? (
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setError('');
                setInfo('');
                setCodeSent(false);
                setCode('');
              }}
              className="text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              disabled={loading}
            >
              {t('usePassword')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMode('sms');
                setError('');
                setInfo('');
                setPassword('');
              }}
              className="text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              disabled={loading}
            >
              {t('useSms')}
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}

function CourierLoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <span className="sr-only">…</span>
    </div>
  );
}

export default function CourierLoginPage() {
  return (
    <Suspense fallback={<CourierLoginFallback />}>
      <CourierLoginForm />
    </Suspense>
  );
}
