'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

function ManagerLoginForm() {
  const t = useTranslations('managerLogin');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';
  const callbackUrl = searchParams?.get('callbackUrl') || `/${locale}/dashboard`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(tAuth('errors.invalidEmailPassword'));
      return;
    }
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        identifier: email.trim(),
        password,
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
          <label htmlFor="manager-email" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('email')}
          </label>
          <input
            id="manager-email"
            type="text"
            placeholder={t('email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            autoComplete="username"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="manager-password" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('password')}
          </label>
          <div className="relative">
            <input
              id="manager-password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
              autoComplete="current-password"
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

        <div className="text-right">
          <Link
            href={`/${locale}/forgot-password`}
            className="text-sm text-primary-500 hover:text-primary-400 hover:underline"
          >
            {tAuth('forgotPassword')}
          </Link>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t('submitting') : t('submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}

function ManagerLoginFallback() {
  const t = useTranslations('loading');
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <span className="sr-only">{t('default')}</span>
    </div>
  );
}

export default function ManagerLoginPage() {
  return (
    <Suspense fallback={<ManagerLoginFallback />}>
      <ManagerLoginForm />
    </Suspense>
  );
}
