'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <header className="sticky top-0 z-header border-b border-gray-100 dark:border-white/10 bg-white/85 dark:bg-navy-900/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2.5 rounded-control transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary-600">
            <Fuel className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight text-navy dark:text-white">{siteConfig.appName}</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href={`/${locale}#how`}
            className="hidden rounded-control px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:text-navy md:inline-block"
          >
            {t('howItWorks')}
          </Link>
          <LanguageSwitcher />
          <B2CThemeToggle />

          {status === 'loading' ? (
            <span className="h-9 w-20 animate-pulse rounded-control bg-gray-100 dark:bg-white/10" aria-hidden />
          ) : role === 'CLIENT' ? (
            <Button variant="secondary" size="sm" className="rounded-control" asChild>
              <Link href={`/${locale}/account`}>{t('account')}</Link>
            </Button>
          ) : role && STAFF_ROLES.has(role) ? (
            <Button variant="secondary" size="sm" className="rounded-control" asChild>
              <Link href={`/${locale}/dashboard`}>{t('dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden rounded-control text-gray-600 dark:text-gray-300 hover:text-navy sm:inline-flex" asChild>
                <Link href={`/${locale}/client-login`} onClick={() => track('login_clicked', { where: 'header' })}>
                  {t('signIn')}
                </Link>
              </Button>
              {showOrderCta && (
                <Button size="sm" className="rounded-control bg-primary-600 font-semibold text-white hover:bg-primary-500" asChild>
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
