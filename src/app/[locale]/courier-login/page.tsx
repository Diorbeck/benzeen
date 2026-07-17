'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

function CourierLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';
  const callbackUrl = searchParams?.get('callbackUrl') || `/${locale}/dashboard`;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !password.trim()) {
      setError('Введите номер телефона и пароль');
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
        setError('Неверный номер телефона или пароль');
        return;
      }
      router.push(callbackUrl as string);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Вход для курьера" subtitle="Войдите по номеру телефона и паролю">
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
          <label htmlFor="courier-phone" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Номер телефона
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

        <div>
          <label htmlFor="courier-password" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Пароль
          </label>
          <input
            id="courier-password"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Вход…' : 'Войти'}
        </Button>
      </form>
    </AuthLayout>
  );
}

function CourierLoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <span className="sr-only">Загрузка…</span>
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
