'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Clock } from 'lucide-react';
import { B2CHeader } from './header';

export function ComingSoon({ section }: { section: 'benzin' | 'propan' }) {
  const t = useTranslations('b2c');
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/').filter(Boolean)[0] || 'ru';
  const safeLocale = ['ru', 'en', 'uz'].includes(locale) ? locale : 'ru';

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 text-navy dark:text-white">
      <B2CHeader />
      <main className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
        <div className="flex flex-col items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-card bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
            <Clock className="h-8 w-8" aria-hidden />
          </span>
          <p className="mt-6 text-sm font-medium text-gray-500 dark:text-gray-400">
            {t(`${section}.title`)}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            {t('comingSoon.title')}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {t('comingSoon.desc')}
          </p>
          <Link
            href={`/${safeLocale}`}
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-control bg-gray-100 dark:bg-white/10 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-200/70 dark:hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-950"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('comingSoon.back')}
          </Link>
        </div>
      </main>
    </div>
  );
}
