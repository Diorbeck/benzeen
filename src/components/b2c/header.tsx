'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';

export function B2CHeader() {
  const t = useTranslations('b2c');
  const tCommon = useTranslations('common');
  const pathname = usePathname() ?? '';
  const locale = pathname.split('/').filter(Boolean)[0] || 'ru';
  const safeLocale = ['ru', 'en', 'uz'].includes(locale) ? locale : 'ru';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href={`/${safeLocale}`}
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600">
            <Fuel className="h-5 w-5 text-white" aria-hidden />
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            {tCommon('appName')}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Button
            size="sm"
            className="bg-primary-600 font-semibold text-white hover:bg-primary-500"
            asChild
          >
            <Link href={`/${safeLocale}/client-login`}>{t('signIn')}</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
