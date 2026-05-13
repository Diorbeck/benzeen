'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

function DriverLoginForm() {
  const t = useTranslations('driverLogin');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';
  const callbackUrl = searchParams?.get('callbackUrl') || `/${locale}/dashboard`;

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !smsCode.trim()) {
      setError(t('errorPhoneCode'));
      return;
    }
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        identifier: phone.trim(),
        password: smsCode,
        mode: 'driver',
        vehicleNumber: vehicleNumber.trim(),
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
          <label htmlFor="driver-vehicle" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('vehicleNumber')}
          </label>
          <input
            id="driver-vehicle"
            type="text"
            placeholder="01A123BC"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            className={inputClass}
            autoComplete="off"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="driver-phone" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('phoneNumber')}
          </label>
          <input
            id="driver-phone"
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
          <label htmlFor="driver-code" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('smsCode')}
          </label>
          <input
            id="driver-code"
            type="password"
            placeholder="SMS code"
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value)}
            required
            className={inputClass}
            autoComplete="one-time-code"
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t('submitting') : t('submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}

function DriverLoginFallback() {
  const t = useTranslations('loading');
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <span className="sr-only">{t('default')}</span>
    </div>
  );
}

export default function DriverLoginPage() {
  return (
    <Suspense fallback={<DriverLoginFallback />}>
      <DriverLoginForm />
    </Suspense>
  );
}
