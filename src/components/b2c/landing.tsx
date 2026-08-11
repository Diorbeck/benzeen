'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Fuel,
  Flame,
  ArrowRight,
  ChevronDown,
  MapPin,
  Navigation,
  Receipt,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { B2CHeader } from './header';
import { track } from '@/lib/analytics';
import { siteConfig } from '@/lib/site-config';
import { captureRefFromUrl } from '@/lib/referral-client';

export function B2CLanding() {
  const t = useTranslations('b2c');
  const pathname = usePathname() ?? '';
  const seg = pathname.split('/').filter(Boolean)[0];
  const locale = seg === 'ru' || seg === 'en' || seg === 'uz' ? seg : 'ru';

  useEffect(() => {
    track('home_viewed');
    captureRefFromUrl();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />

      <main>
        <Hero locale={locale} />
        <Services locale={locale} />
        <HowItWorks />
        <Faq />
        <Footer locale={locale} />
      </main>

      {/* Mobile fixed order CTA — bottom bar is one of the two allowed blur surfaces */}
      <div className="fixed inset-x-0 bottom-0 z-header border-t border-gray-200/60 bg-white/85 p-3 backdrop-blur-md dark:border-white/10 dark:bg-navy-900/85 sm:hidden">
        <Button size="lg" className="w-full" asChild>
          <Link href={`/${locale}/benzin`} onClick={() => track('gasoline_order_clicked', { where: 'mobile_bar' })}>
            {t('orderFuel')}
          </Link>
        </Button>
      </div>
      {/* Spacer so content isn't hidden behind the mobile bar */}
      <div className="h-20 sm:hidden" aria-hidden />
    </div>
  );
}

function Hero({ locale }: { locale: string }) {
  const t = useTranslations('b2c');
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-14 text-center sm:px-6 lg:px-8 lg:pb-24 lg:pt-24">
      <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-navy dark:text-white sm:text-5xl lg:text-display">
        {t('hero.title')}
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-gray-600 dark:text-gray-300 lg:text-xl">
        {t('hero.subtitle')}
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" className="w-full sm:w-auto" asChild>
          <Link href={`/${locale}/benzin`} onClick={() => track('gasoline_order_clicked', { where: 'hero' })}>
            {t('hero.ctaBenzin')}
          </Link>
        </Button>
        <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
          <Link href={`/${locale}/propan`} onClick={() => track('propane_points_clicked', { where: 'hero' })}>
            {t('hero.ctaPropan')}
          </Link>
        </Button>
      </div>
      <a
        href="#how"
        className="mt-8 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:text-primary-400 dark:hover:text-primary-300"
      >
        {t('hero.how')}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
      <HeroVisual />
    </section>
  );
}

/** Hero visual built from real UI: a stylized map with a route + a live order card. */
function HeroVisual() {
  const t = useTranslations('b2c');
  return (
    <div className="relative mx-auto mt-14 w-full max-w-3xl lg:mt-20">
      <div className="relative overflow-hidden rounded-card border border-gray-200/60 bg-white text-left shadow-soft-lg dark:border-white/10 dark:bg-navy-900">
        {/* Map panel */}
        <div className="relative h-64 bg-gray-100 dark:bg-navy-800 sm:h-80">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(19,34,79,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(19,34,79,0.07) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden
          />
          <svg
            className="absolute inset-0 h-full w-full text-primary-600 dark:text-primary-400"
            viewBox="0 0 400 288"
            fill="none"
            aria-hidden
          >
            <path
              d="M60 235 C 130 200, 150 120, 250 110 S 340 70, 345 55"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="2 12"
            />
          </svg>
          {/* courier — static marker; live pulse belongs to the real tracking map */}
          <span className="absolute left-[14%] top-[80%] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <span className="absolute h-6 w-6 rounded-full bg-primary-600/15" />
            <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-primary-600 shadow" />
          </span>
          {/* destination */}
          <span className="absolute left-[85%] top-[19%] -translate-x-1/2 -translate-y-full text-navy dark:text-white">
            <MapPin className="h-7 w-7 fill-navy/10 dark:fill-white/10" aria-hidden />
          </span>
        </div>
        {/* Order card — illustrative, facts only (no fabricated price/ETA). */}
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
              <Navigation className="h-3.5 w-3.5" aria-hidden />
              {t('heroCard.status')}
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('heroCard.coverage')}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/10">
            <div>
              <p className="text-sm font-semibold text-navy dark:text-white">АИ-92</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('heroCard.priceLabel')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-success-600 dark:text-success-500">{t('heroCard.freeDelivery')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('heroCard.cardPay')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Services({ locale }: { locale: string }) {
  const t = useTranslations('b2c');
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
        {/* Benzin — primary */}
        <div className="flex flex-col justify-between gap-8 rounded-card border border-gray-200/60 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-navy-900 sm:p-8">
          <div>
            <Fuel className="h-7 w-7 text-navy dark:text-white" aria-hidden />
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-navy dark:text-white">
              {t('services.benzin.title')}
            </h3>
            <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              {t('services.benzin.desc')}
            </p>
          </div>
          <Button asChild>
            <Link href={`/${locale}/benzin`} onClick={() => track('gasoline_order_clicked', { where: 'services' })}>
              {t('services.benzin.cta')}
            </Link>
          </Button>
        </div>
        {/* Propan — secondary */}
        <div className="flex flex-col justify-between gap-8 rounded-card border border-gray-200/60 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-navy-900 sm:p-8">
          <div>
            <Flame className="h-7 w-7 text-navy dark:text-white" aria-hidden />
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-navy dark:text-white">
              {t('services.propan.title')}
            </h3>
            <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              {t('services.propan.desc')}
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href={`/${locale}/propan`} onClick={() => track('propane_points_clicked', { where: 'services' })}>
              {t('services.propan.cta')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslations('b2c');
  const steps = [
    { icon: MapPin, key: 'step1' },
    { icon: Fuel, key: 'step2' },
    { icon: Receipt, key: 'step3' },
  ] as const;
  return (
    <section id="how" className="scroll-mt-20 bg-white py-16 dark:bg-navy-900 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-title">
          {t('how.title')}
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:gap-6">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.key} className="rounded-card bg-gray-50 p-6 dark:bg-navy-950 sm:p-8">
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400" aria-hidden />
                  <span className="text-sm font-medium tabular-nums text-gray-400 dark:text-gray-500">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-subheading text-navy dark:text-white">{t(`how.${s.key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {t(`how.${s.key}.desc`)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  const t = useTranslations('b2c');
  const qs = ['q1', 'q2', 'q3', 'q4'] as const;
  return (
    <section className="bg-white pb-16 dark:bg-navy-900 lg:pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-title">
          {t('faq.title')}
        </h2>
        <div className="mt-10 divide-y divide-gray-100 rounded-card border border-gray-200/60 dark:divide-white/10 dark:border-white/10">
          {qs.map((q) => (
            <details key={q} className="group px-5 py-5 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-navy dark:text-white">
                {t(`faq.${q}.q`)}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180 dark:text-gray-500"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t(`faq.${q}.a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ locale }: { locale: string }) {
  const t = useTranslations('b2c');
  return (
    <footer className="border-t border-gray-200/60 bg-gray-50 dark:border-white/10 dark:bg-navy-950">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-navy dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600">
              <Fuel className="h-4 w-4 text-white" aria-hidden />
            </span>
            {siteConfig.appName}
          </span>
          <p className="mt-3 max-w-xs text-sm text-gray-500 dark:text-gray-400">{t('footer.tagline')}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-navy dark:text-white">{t('footer.contactsTitle')}</h4>
          <a
            href={`tel:${siteConfig.supportPhone}`}
            className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 dark:text-gray-300"
          >
            <Phone className="h-4 w-4" aria-hidden />
            {siteConfig.supportPhone}
          </a>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-navy dark:text-white">{t('footer.docsTitle')}</h4>
          <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Link href={`/${locale}/terms`} className="hover:text-primary-600">
              {t('footer.terms')}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-primary-600">
              {t('footer.privacy')}
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="border-t border-gray-200/60 py-4 dark:border-white/10">
        <p className="mx-auto max-w-[1200px] px-4 text-xs text-gray-400 dark:text-gray-500 sm:px-6 lg:px-8">
          © {siteConfig.appName}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
