'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email.trim(),
          method: 'email',
          purpose: 'password_reset',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('success'));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t('success'));
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
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link
              href={`/${locale}/reset-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
            >
              {t('continueToReset')}
            </Link>
          </Button>
          <Link
            href={`/${locale}/manager-login`}
            className="text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            {t('backToLogin')}
          </Link>
        </div>
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
          <label htmlFor="forgot-email" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('email')}
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            placeholder={t('email')}
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t('submitting') : t('submit')}
        </Button>

        <p className="text-center">
          <Link href={`/${locale}/manager-login`} className="text-sm text-primary-500 hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
