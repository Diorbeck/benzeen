'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Fuel, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-500';

export function AuthLayout({
  children,
  title,
  subtitle,
  backHref,
  backLabel,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
}) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/')[1] || 'ru';
  const href = backHref ?? `/${locale}/login`;
  const label = backLabel ?? t('backToRoleSelection');

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md"
      >
        <div className="relative rounded-2xl border border-gray-200/60 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-gray-900/80 dark:backdrop-blur">
          <Link
            href={`/${locale}`}
            className="mb-8 inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
              <Fuel className="h-5 w-5 text-white" aria-hidden />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {tCommon('appName')}
            </span>
          </Link>

          <Link
            href={href}
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
            {label}
          </Link>

          <h1 className="mb-2 text-center text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>

          {children}
        </div>
      </motion.div>
    </div>
  );
}

export { inputClass };
