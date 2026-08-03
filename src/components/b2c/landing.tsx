'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Fuel,
  Flame,
  ArrowRight,
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
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950 text-navy dark:text-white">
      <B2CHeader />

      <main>
        <Hero locale={locale} />
        <Services locale={locale} />
        <HowItWorks />
        <Faq />
        <Footer locale={locale} />
      </main>

      {/* Mobile fixed order CTA */}
      <div className="fixed inset-x-0 bottom-0 z-header border-t border-gray-100 dark:border-white/10 bg-white/95 dark:bg-navy-900/95 p-3 backdrop-blur sm:hidden">
        <Button
          size="lg"
          className="w-full rounded-control bg-primary-600 text-base font-semibold text-white hover:bg-primary-500"
          asChild
        >
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
    <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-20 lg:pt-16">
      <div>
        <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-navy dark:text-white sm:text-5xl">
          {t('hero.title')}
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-600 dark:text-gray-300">{t('hero.subtitle')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            className="rounded-control bg-primary-600 text-base font-semibold text-white hover:bg-primary-500"
            asChild
          >
            <Link href={`/${locale}/benzin`} onClick={() => track('gasoline_order_clicked', { where: 'hero' })}>
              {t('hero.ctaBenzin')}
            </Link>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-control text-base"
            asChild
          >
            <Link href={`/${locale}/propan`} onClick={() => track('propane_points_clicked', { where: 'hero' })}>
              {t('hero.ctaPropan')}
            </Link>
          </Button>
        </div>
        <a href="#how" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">
          {t('hero.how')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
      <HeroVisual />
    </section>
  );
}

/** Hero visual built from real UI: a stylized map with a route + a live order card. */
function HeroVisual() {
  const t = useTranslations('b2c');
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative overflow-hidden rounded-card border border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 shadow-soft-lg">
        {/* Map panel */}
        <div className="relative h-64 bg-[#eef2f7] dark:bg-navy-900 sm:h-72">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(#dbe3ee 1px, transparent 1px), linear-gradient(90deg, #dbe3ee 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden
          />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 288" fill="none" aria-hidden>
            <path
              d="M60 235 C 130 200, 150 120, 250 110 S 340 70, 345 55"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="2 12"
            />
          </svg>
          {/* courier */}
          <span className="absolute left-[14%] top-[80%] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <span className="absolute h-6 w-6 animate-ping rounded-full bg-primary-500/25" />
            <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow" />
          </span>
          {/* destination */}
          <span className="absolute left-[85%] top-[19%] -translate-x-1/2 -translate-y-full text-primary-600 dark:text-primary-400">
            <MapPin className="h-7 w-7 fill-primary-600/15" aria-hidden />
          </span>
        </div>
        {/* Order card — illustrative, facts only (no fabricated price/ETA). */}
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-500/15 px-2.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
              <Navigation className="h-3.5 w-3.5" aria-hidden />
              {t('heroCard.status')}
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('heroCard.coverage')}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/10 pt-3">
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
    <section className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Benzin — primary */}
        <div className="flex flex-col justify-between gap-6 rounded-card border border-primary-100 dark:border-primary-500/30 bg-white dark:bg-navy-900 p-6 shadow-soft sm:p-8">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-control bg-primary-600 text-white">
              <Fuel className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-semibold text-navy dark:text-white">{t('services.benzin.title')}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t('services.benzin.desc')}</p>
          </div>
          <Button className="rounded-control bg-primary-600 font-semibold text-white hover:bg-primary-500" asChild>
            <Link href={`/${locale}/benzin`} onClick={() => track('gasoline_order_clicked', { where: 'services' })}>
              {t('services.benzin.cta')}
            </Link>
          </Button>
        </div>
        {/* Propan — secondary */}
        <div className="flex flex-col justify-between gap-6 rounded-card border border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 p-6 shadow-soft sm:p-8">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-control bg-navy text-white">
              <Flame className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-semibold text-navy dark:text-white">{t('services.propan.title')}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t('services.propan.desc')}</p>
          </div>
          <Button variant="secondary" className="rounded-control" asChild>
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
    <section id="how" className="scroll-mt-20 bg-white dark:bg-navy-900 py-14 lg:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-navy dark:text-white sm:text-3xl">{t('how.title')}</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.key} className="relative rounded-card border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-navy-950 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                  {i + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-navy dark:text-white">{t(`how.${s.key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t(`how.${s.key}.desc`)}</p>
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
    <section className="bg-white dark:bg-navy-900 py-14 lg:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-navy dark:text-white sm:text-3xl">{t('faq.title')}</h2>
        <div className="mt-8 divide-y divide-gray-100 dark:divide-white/10 rounded-card border border-gray-100 dark:border-white/10">
          {qs.map((q) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-navy dark:text-white">
                {t(`faq.${q}.q`)}
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform group-open:rotate-90" aria-hidden />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t(`faq.${q}.a`)}</p>
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
    <footer className="border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-navy-950">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <span className="flex items-center gap-2 text-lg font-semibold text-navy dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-600">
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
            className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600"
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
      <div className="border-t border-gray-100 dark:border-white/10 py-4">
        <p className="mx-auto max-w-[1240px] px-4 text-xs text-gray-400 dark:text-gray-500 sm:px-6 lg:px-8">
          © {siteConfig.appName}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
