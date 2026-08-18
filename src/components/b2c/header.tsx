'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { BenzeenLogo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { B2CThemeToggle } from './theme-toggle';
import { track } from '@/lib/analytics';
import { siteConfig } from '@/lib/site-config';

const STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'DRIVER',
  'COURIER',
  'DISPATCHER',
  'PROPANE_OPERATOR',
]);

/** B2C header: session-aware — CLIENT → cabinet, staff → dashboard, guest → sign in + order CTA. */
export function B2CHeader({ showOrderCta = true }: { showOrderCta?: boolean }) {
  const t = useTranslations('b2c');
  const pathname = usePathname() ?? '';
  const seg = pathname.split('/').filter(Boolean)[0];
  const locale = seg === 'ru' || seg === 'en' || seg === 'uz' ? seg : 'ru';
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <header className="sticky top-0 z-header border-b border-gray-100 dark:border-white/10 bg-white/95 backdrop-blur dark:bg-navy-950/95">
      <nav className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          aria-label={siteConfig.appName}
          className="shrink-0 rounded-control transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <BenzeenLogo size="lg" />
        </Link>

        {/* Навигация по разделам первого экрана: заправки рядом — то, за чем
            приходят чаще всего, поэтому ссылка стоит рядом с «как это работает». */}
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <Link
            href={`/${locale}#map`}
            className="rounded-control px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-navy dark:text-gray-300 dark:hover:text-white"
          >
            {t('nav.stations')}
          </Link>
          <Link
            href={`/${locale}#how`}
            className="rounded-control px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-navy dark:text-gray-300 dark:hover:text-white"
          >
            {t('howItWorks')}
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LanguageSwitcher />
          {/* Системный режим на телефоне убран из шапки: три кнопки не влезают
              рядом с логотипом и входом, светлая/тёмная закрывают сценарий. */}
          <B2CThemeToggle hideSystemOnMobile />

          {status === 'loading' ? (
            <span className="h-10 w-24 animate-pulse rounded-control bg-gray-100 dark:bg-white/10" aria-hidden />
          ) : role === 'CLIENT' ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/${locale}/account`}>{t('account')}</Link>
            </Button>
          ) : role && STAFF_ROLES.has(role) ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/${locale}/dashboard`}>{t('dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/client-login`} onClick={() => track('login_clicked', { where: 'header' })}>
                  {t('signIn')}
                </Link>
              </Button>
              {showOrderCta && (
                <Button size="sm" className="hidden sm:inline-flex" asChild>
                  <Link
                    href={`/${locale}/benzin`}
                    onClick={() => track('gasoline_order_clicked', { where: 'header' })}
                  >
                    {t('orderFuel')}
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
