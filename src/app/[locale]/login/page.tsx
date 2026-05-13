'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Fuel, ArrowLeft, BriefcaseBusiness, Car } from 'lucide-react';
import { useTranslations } from 'next-intl';

function LoginRoleSelection() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-2xl border border-gray-200/60 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-gray-900/80 dark:backdrop-blur">
          <Link
            href={`/${locale}`}
            className="mb-8 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
              <Fuel className="h-5 w-5 text-white" aria-hidden />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {tCommon('appName')}
            </span>
          </Link>

          <Link
            href={`/${locale}`}
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToHomepage')}
          </Link>

          <h1 className="mb-2 text-center text-xl font-semibold text-gray-900 dark:text-white">
            {t('chooseRoleTitle')}
          </h1>
          <p className="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('chooseRoleSubtitle')}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href={`/${locale}/manager-login`}
              className="group flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-0.5 hover:border-primary-500/30 hover:bg-white/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-500/30 dark:hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition group-hover:bg-primary-500/30">
                <BriefcaseBusiness className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('managerLogin')}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('managerRoleDesc')}
              </span>
            </Link>
            <Link
              href={`/${locale}/driver-login`}
              className="group flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-0.5 hover:border-primary-500/30 hover:bg-white/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-500/30 dark:hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition group-hover:bg-primary-500/30">
                <Car className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('driverLogin')}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('driverRoleDesc')}
              </span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LoginFallback() {
  const t = useTranslations('loading');
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <span className="sr-only">{t('default')}</span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginRoleSelection />
    </Suspense>
  );
}
