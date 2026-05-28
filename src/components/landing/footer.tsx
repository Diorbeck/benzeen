'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fuel } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';

const footerNav = [
  { href: '#features', key: 'features' as const },
  { href: '#how-it-works', key: 'howItWorks' as const },
  { href: '#contact', key: 'contact' as const },
] as const;

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('common.nav');
  const pathname = usePathname() ?? '';
  const locale = pathname.startsWith('/en') ? 'en' : pathname.startsWith('/uz') ? 'uz' : 'ru';

  return (
    <footer className="border-t border-gray-200 dark:border-white/5 transition-colors duration-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
                <Fuel className="h-4 w-4 text-white" aria-hidden />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Benzeen</span>
            </Link>
            <p className="text-sm text-gray-500">{t('location')}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-6" aria-label="Footer navigation">
            {footerNav.map(({ href, key }) => (
              <Link
                key={key}
                href={href}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                {tNav(key)}
              </Link>
            ))}
            <div className="w-full sm:w-auto">
              <LanguageSwitcher />
            </div>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-gray-200 dark:border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Benzeen. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
