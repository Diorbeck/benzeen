'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Fuel, Flame, ArrowRight } from 'lucide-react';
import { B2CHeader } from './header';

type Section = {
  key: 'benzin' | 'propan';
  href: string;
  icon: typeof Fuel;
};

export function B2CLanding() {
  const t = useTranslations('b2c');
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/').filter(Boolean)[0] || 'ru';
  const safeLocale = ['ru', 'en', 'uz'].includes(locale) ? locale : 'ru';

  const sections: Section[] = [
    { key: 'benzin', href: `/${safeLocale}/benzin`, icon: Fuel },
    { key: 'propan', href: `/${safeLocale}/propan`, icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <B2CHeader />

      <main className="mx-auto flex max-w-5xl flex-col px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="max-w-2xl text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl"
        >
          {t('chooseSection')}
        </motion.h1>

        <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.1 + i * 0.08,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                <Link
                  href={s.href}
                  className="group flex h-full flex-col justify-between gap-10 rounded-3xl border border-gray-200 bg-gray-50 p-8 transition-all hover:-translate-y-1 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-soft-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:p-10"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white transition-transform group-hover:scale-105">
                    <Icon className="h-7 w-7" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                      {t(`${s.key}.title`)}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                      {t(`${s.key}.desc`)}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
                      {t('open')}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
