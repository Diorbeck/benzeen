'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fuel, User, Car, CreditCard, MapPin, Clock, LifeBuoy, type LucideIcon } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { B2CThemeToggle } from '@/components/b2c/theme-toggle';
import { Tabbar, TABBAR_SPACE } from '@/components/b2c/tabbar';
import {
  type AccountOrder,
  type AccountCar,
  type AccountLocation,
  type ReferralStats,
  type AccountTab,
} from '@/components/account/shared';
import { ProfileSection } from '@/components/account/sections/profile-section';
import { CarsSection } from '@/components/account/sections/cars-section';
import { PaymentSection } from '@/components/account/sections/payment-section';
import { LocationsSection } from '@/components/account/sections/locations-section';
import { HistorySection } from '@/components/account/sections/history-section';
import { SupportSection } from '@/components/account/sections/support-section';

export type { AccountOrder, AccountCar, AccountLocation, ReferralStats };

const TABS: { key: AccountTab; icon: LucideIcon }[] = [
  { key: 'profile', icon: User },
  { key: 'cars', icon: Car },
  { key: 'payment', icon: CreditCard },
  { key: 'locations', icon: MapPin },
  { key: 'history', icon: Clock },
  { key: 'support', icon: LifeBuoy },
];

export function AccountView({
  locale,
  phone,
  name,
  lastName,
  orders = [],
  cars = [],
  referral,
  locations = [],
  defaultCarId = null,
  defaultLocationId = null,
}: {
  locale: string;
  phone: string;
  name: string;
  lastName: string;
  orders?: AccountOrder[];
  cars?: AccountCar[];
  referral?: ReferralStats;
  locations?: AccountLocation[];
  defaultCarId?: string | null;
  defaultLocationId?: string | null;
}) {
  const t = useTranslations('account');
  const [tab, setTab] = useState<AccountTab>('profile');

  // Вкладку можно открыть по ссылке (?tab=history — «Заказы» из таббара);
  // повторный тап по таббару на этой же странице тоже должен переключить её.
  const qsTab = useSearchParams()?.get('tab');
  useEffect(() => {
    if (qsTab && TABS.some((x) => x.key === qsTab)) setTab(qsTab as AccountTab);
  }, [qsTab]);

  return (
    <div className={`min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white ${TABBAR_SPACE}`}>
      <header className="sticky top-0 z-header border-b border-gray-200/60 dark:border-white/10 bg-white dark:bg-navy-900">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={`/${locale}`} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary-500">
              <Fuel className="h-5 w-5 text-white" aria-hidden />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight text-navy dark:text-white">{t('title')}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <B2CThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
          {/* Mobile: horizontal scroll. Desktop: left vertical menu. */}
          <nav
            aria-label={t('title')}
            className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:mb-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {TABS.map(({ key, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-control px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-950 lg:w-full ${
                    active
                      ? 'bg-primary-500 text-primary-950'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 lg:bg-transparent lg:dark:bg-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {t(`tabs.${key}`)}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {tab === 'profile' && <ProfileSection locale={locale} phone={phone} name={name} lastName={lastName} />}
            {tab === 'cars' && <CarsSection cars={cars} defaultCarId={defaultCarId} />}
            {tab === 'payment' && <PaymentSection locale={locale} referral={referral} />}
            {tab === 'locations' && (
              <LocationsSection locations={locations} defaultLocationId={defaultLocationId} />
            )}
            {tab === 'history' && <HistorySection locale={locale} orders={orders} />}
            {tab === 'support' && <SupportSection />}
          </div>
        </div>
      </main>

      <Tabbar locale={locale} />
    </div>
  );
}
