'use client';

import { useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordForm() {
  const t = useTranslations('resetPassword');
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const locale = pathname.split('/')[1] || 'ru';
  const emailFromQuery = searchParams?.get('email') ?? '';

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('validation.codeRequired'));
      return;
    }
    if (code.replace(/\D/g, '').length !== 6) {
      setError(t('validation.codeRequired'));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('validation.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('validation.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.replace(/\D/g, ''),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('validation.passwordsDoNotMatch'));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t('validation.passwordsDoNotMatch'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout title={t('title')} subtitle={t('subtitle')}>
        <div className="rounded-xl bg-emerald-500/10 px-4 py-4 text-center text-sm text-emerald-600 dark:text-emerald-400" role="status">
          {t('success')}
        </div>
        <Button asChild className="mt-6 w-full">
          <Link href={`/${locale}/manager-login`}>{t('logIn')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('title')} subtitle={t('subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p
            className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        <div>
          <label htmlFor="reset-email" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('email')}
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className={inputClass}
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="reset-code" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('recoveryCode')}
          </label>
          <input
            id="reset-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className={inputClass}
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="reset-new" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('newPassword')}
          </label>
          <div className="relative">
            <input
              id="reset-new"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={inputClass}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('confirmPassword')}
          </label>
          <input
            id="reset-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={inputClass}
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t('submitting') : t('submit')}
        </Button>

        <p className="text-center">
          <Link href={`/${locale}/forgot-password`} className="text-sm text-primary-500 hover:underline">
            {t('backToForgot')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function ResetPasswordFallback() {
  const t = useTranslations('resetPassword');
  return (
    <AuthLayout title={t('title')} subtitle={t('subtitle')}>
      <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
