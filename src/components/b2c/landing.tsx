'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Fuel,
  Flame,
  ArrowRight,
  ChevronDown,
  MapPin,
  CalendarClock,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { B2CHeader } from './header';
import { HomeStationsMap } from './home-stations-map';
import { ScrollJourney } from './scroll-journey';
import { track } from '@/lib/analytics';
import { siteConfig } from '@/lib/site-config';
import { captureRefFromUrl } from '@/lib/referral-client';

const FUELS = ['AI_92', 'AI_95', 'AI_100'] as const;
const FUEL_LABEL: Record<(typeof FUELS)[number], string> = {
  AI_92: 'АИ-92',
  AI_95: 'АИ-95',
  AI_100: 'АИ-100',
};

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
    <div className="min-h-screen bg-white text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      {/* Десктопная скролл-анимация: машина едет по фону к заправке внизу,
          индикатор бака следует за позицией скролла. */}
      <ScrollJourney />

      <main className="relative z-10">
        <Hero locale={locale} />
        <HomeStationsMap locale={locale} />
        <Services locale={locale} />
        <HowItWorks />
        <Faq />
        <Footer locale={locale} />
      </main>

      {/* Мобильный нижний CTA — форма-первый и на телефоне */}
      <div className="fixed inset-x-0 bottom-0 z-header border-t border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-navy-900 sm:hidden">
        <Button size="lg" className="w-full" asChild>
          <Link href={`/${locale}/benzin`} onClick={() => track('gasoline_order_clicked', { where: 'mobile_bar' })}>
            {t('orderFuel')}
          </Link>
        </Button>
      </div>
      <div className="h-20 sm:hidden" aria-hidden />
    </div>
  );
}

/** Форма-первый hero: заголовок → виджет заказа → продуктовый визуал справа. */
function Hero({ locale }: { locale: string }) {
  const t = useTranslations('b2c');
  const router = useRouter();
  const [fuel, setFuel] = useState<(typeof FUELS)[number]>('AI_92');

  const startOrder = (where: string) => {
    track('gasoline_order_clicked', { where });
    router.push(`/${locale}/benzin?fuel=${fuel}`);
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
      <div>
        <h1 className="max-w-2xl font-display text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-navy dark:text-white sm:text-title lg:text-display">
          {t('hero.title')}
        </h1>

        <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-400">
          {t('hero.subtitle')}
        </p>

        {/* Панель заказа: главное действие, читается как инструмент и целиком
            попадает в первый экран — за ним сразу карта АЗС. */}
        <div className="mt-6 space-y-3 rounded-card border border-gray-200 bg-gray-50 p-4 dark:border-navy-700 dark:bg-navy-900 lg:flex lg:items-center lg:gap-3 lg:space-y-0 lg:p-5">
          <button
            type="button"
            onClick={() => startOrder('hero_widget_where')}
            className="flex h-12 w-full items-center gap-3 rounded-control border border-gray-200 bg-white px-4 text-left text-body text-gray-500 transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:border-white/20 dark:focus-visible:ring-white/60 lg:min-w-0 lg:flex-1"
          >
            <MapPin className="h-5 w-5 shrink-0 text-navy dark:text-white" aria-hidden />
            {t('widgetWhere')}
          </button>

          <div className="grid grid-cols-3 gap-2 lg:flex lg:shrink-0">
            {FUELS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFuel(f)}
                className={`h-11 rounded-control px-3 text-sm font-medium transition-colors lg:min-w-[84px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 dark:focus-visible:ring-white/60 ${
                  fuel === f
                    ? 'border-2 border-primary-600 bg-white text-navy dark:border-primary-400 dark:bg-primary-500/15 dark:text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:border-white/20'
                }`}
              >
                {FUEL_LABEL[f]}
              </button>
            ))}
          </div>

          <Button size="lg" className="w-full lg:w-auto lg:shrink-0 lg:px-8" onClick={() => startOrder('hero_widget')}>
            {t('widgetCta')}
          </Button>
        </div>
      </div>

    </section>
  );
}

/** Ряд карточек-сервисов как Uber Ride/Reserve: серые заливки, без теней. */
function Services({ locale }: { locale: string }) {
  const t = useTranslations('b2c');
  const cards = [
    {
      icon: Fuel,
      title: t('services.benzin.title'),
      desc: t('services.benzin.desc'),
      cta: t('services.benzin.cta'),
      href: `/${locale}/benzin`,
      event: 'gasoline_order_clicked' as const,
    },
    {
      icon: Flame,
      title: t('services.propan.title'),
      desc: t('services.propan.desc'),
      cta: t('services.propan.cta'),
      href: `/${locale}/propan`,
      event: 'propane_points_clicked' as const,
    },
    {
      icon: CalendarClock,
      title: t('svcScheduleTitle'),
      desc: t('svcScheduleDesc'),
      cta: t('widgetCta'),
      href: `/${locale}/benzin?schedule=1`,
      event: 'gasoline_order_clicked' as const,
    },
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              href={c.href}
              onClick={() => track(c.event, { where: 'services' })}
              className="group flex flex-col justify-between rounded-card bg-gray-100 p-5 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 dark:bg-navy-900 dark:hover:bg-navy-800 dark:focus-visible:ring-white/60"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-subheading text-navy dark:text-white">{c.title}</h3>
                  <Icon className="h-6 w-6 text-navy dark:text-white" aria-hidden />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{c.desc}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy group-hover:gap-2 dark:text-white">
                {c.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Компактный «как это работает»: три шага текстом, без карточек-декораций. */
function HowItWorks() {
  const t = useTranslations('b2c');
  const steps = ['step1', 'step2', 'step3'] as const;
  return (
    <section id="how" className="scroll-mt-20 border-t border-gray-100 py-12 dark:border-white/10 lg:py-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h2 className="text-heading text-navy dark:text-white">{t('how.title')}</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((key, i) => (
            <li key={key}>
              <p className="text-sm font-semibold tabular-nums text-gray-400 dark:text-gray-500">0{i + 1}</p>
              <h3 className="mt-1 text-sm font-semibold text-navy dark:text-white">{t(`how.${key}.title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{t(`how.${key}.desc`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  const t = useTranslations('b2c');
  const qs = ['q1', 'q2', 'q3', 'q4'] as const;
  return (
    <section className="border-t border-gray-100 py-12 dark:border-white/10 lg:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-heading text-navy dark:text-white">{t('faq.title')}</h2>
        <div className="mt-6 divide-y divide-gray-100 dark:divide-white/10">
          {qs.map((q) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body font-medium text-navy dark:text-white">
                {t(`faq.${q}.q`)}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180 dark:text-gray-500"
                  aria-hidden
                />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{t(`faq.${q}.a`)}</p>
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
    <footer className="border-t border-gray-100 dark:border-white/10">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <span className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-navy dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-600 text-white dark:bg-primary-500">
              <Fuel className="h-4 w-4" aria-hidden />
            </span>
            {siteConfig.appName}
          </span>
          <p className="mt-3 max-w-xs text-sm text-gray-500 dark:text-gray-400">{t('footer.tagline')}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-navy dark:text-white">{t('footer.contactsTitle')}</h4>
          <a
            href={`tel:${siteConfig.supportPhone}`}
            className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-navy dark:text-gray-300 dark:hover:text-white"
          >
            <Phone className="h-4 w-4" aria-hidden />
            {siteConfig.supportPhone}
          </a>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-navy dark:text-white">{t('footer.docsTitle')}</h4>
          <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Link href={`/${locale}/terms`} className="hover:text-navy dark:hover:text-white">
              {t('footer.terms')}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-navy dark:hover:text-white">
              {t('footer.privacy')}
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 dark:border-white/10">
        <p className="mx-auto max-w-[1200px] px-4 text-caption text-gray-400 dark:text-gray-500 sm:px-6 lg:px-8">
          © {siteConfig.appName}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
