"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Fuel,
  Flame,
  ChevronRight,
  Plus,
  CalendarClock,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { B2CHeader } from "./header";
import { HomeStationsMap } from "./home-stations-map";
import { OrderPanel } from "./order-panel";
import { NearbyAndPay } from "./nearby-and-pay";
import { useHomeStations } from "./use-home-stations";
import { ScrollJourney } from "./scroll-journey";
import { track } from "@/lib/analytics";
import { siteConfig } from "@/lib/site-config";
import { captureRefFromUrl } from "@/lib/referral-client";
import { Reveal } from "@/components/motion/reveal";

// Главная в духе apple.com: одна мысль на экран, много воздуха, крупная
// спокойная типографика. Секции чередуют белый и тонированный фон — полосы
// отделяются тоном, а не рамками. Тиффани — только действие и живые данные.

export function B2CLanding() {
  const t = useTranslations("b2c");
  const pathname = usePathname() ?? "";
  const seg = pathname.split("/").filter(Boolean)[0];
  const locale = seg === "ru" || seg === "en" || seg === "uz" ? seg : "ru";

  useEffect(() => {
    track("home_viewed");
    captureRefFromUrl();
  }, []);

  return (
    <div className="min-h-screen bg-white text-navy antialiased dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      {/* Индикатор бака: страница «заправляется» вместе со скроллом. */}
      <ScrollJourney />

      <main>
        <Hero locale={locale} />
        <Console locale={locale} />
        <Services locale={locale} />
        <HowItWorks />
        <Faq />
      </main>
      <Footer locale={locale} />

      {/* Мобильный нижний CTA — полупрозрачный слой, контент виден под ним. */}
      <div
        className="fixed inset-x-0 bottom-0 z-header border-t border-black/5 bg-white/80 px-4 pt-3 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-navy-950/80 sm:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <Button size="lg" className="w-full rounded-full" asChild>
          <Link
            href={`/${locale}/benzin`}
            onClick={() =>
              track("gasoline_order_clicked", { where: "mobile_bar" })
            }
          >
            {t("orderFuel")}
          </Link>
        </Button>
      </div>
      <div className="h-20 sm:hidden" aria-hidden />
    </div>
  );
}

/** Первый экран: одна фраза, одно пояснение, одно действие. */
function Hero({ locale }: { locale: string }) {
  const t = useTranslations("b2c");
  return (
    <section className="px-5 pb-14 pt-14 text-center sm:pb-20 sm:pt-24 lg:pt-28">
      <h1 className="mx-auto max-w-[18ch] font-sans text-[42px] font-semibold leading-[1.05] tracking-[-0.035em] text-navy dark:text-white sm:text-[64px] lg:text-[80px]">
        {t("console.headline")}{" "}
        <span className="text-primary-700 dark:text-primary-300 sm:block">
          {t("console.headlineAccent")}
        </span>
      </h1>
      <p className="mx-auto mt-6 max-w-[34rem] text-[17px] leading-relaxed text-gray-600 dark:text-gray-400 sm:text-[21px] sm:leading-[1.45]">
        {t("console.lede")}
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        <Button
          size="lg"
          className="h-12 rounded-full px-7 text-[17px] font-medium"
          asChild
        >
          <Link
            href={`/${locale}/benzin`}
            onClick={() => track("gasoline_order_clicked", { where: "hero" })}
          >
            {t("console.cta")}
          </Link>
        </Button>
        <Link
          href={`/${locale}#map`}
          className="inline-flex items-center gap-0.5 text-[17px] font-medium text-primary-800 hover:underline dark:text-primary-300"
        >
          {t("nav.stations")}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** Заказ и карта топлива — одна тонированная полоса, две крупные плитки. */
function Console({ locale }: { locale: string }) {
  const data = useHomeStations();

  return (
    <section className="bg-mist-50 py-12 dark:bg-navy-900 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-5">
          <OrderPanel locale={locale} located={data.located} />
          <HomeStationsMap locale={locale} data={data} />
        </Reveal>
        <Reveal className="mt-4 lg:mt-5">
          <NearbyAndPay locale={locale} data={data} />
        </Reveal>
      </div>
    </section>
  );
}

/** Три сервиса — плитки с крупным заголовком и ссылкой-шевроном. */
function Services({ locale }: { locale: string }) {
  const t = useTranslations("b2c");
  const cards = [
    {
      icon: Fuel,
      title: t("services.benzin.title"),
      desc: t("services.benzin.desc"),
      cta: t("services.benzin.cta"),
      href: `/${locale}/benzin`,
      event: "gasoline_order_clicked" as const,
    },
    {
      icon: Flame,
      title: t("services.propan.title"),
      desc: t("services.propan.desc"),
      cta: t("services.propan.cta"),
      href: `/${locale}/propan`,
      event: "propane_points_clicked" as const,
    },
    {
      icon: CalendarClock,
      title: t("svcScheduleTitle"),
      desc: t("svcScheduleDesc"),
      cta: t("widgetCta"),
      href: `/${locale}/benzin?schedule=1`,
      event: "gasoline_order_clicked" as const,
    },
  ];
  return (
    <section className="py-16 sm:py-24">
      <Reveal className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-6 lg:gap-5 lg:px-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              href={c.href}
              onClick={() => track(c.event, { where: "services" })}
              className="group flex min-h-[15rem] flex-col rounded-[28px] bg-mist-50 p-7 transition-transform duration-300 ease-out hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 motion-reduce:hover:scale-100 dark:bg-navy-900 dark:focus-visible:ring-white/60 sm:p-8"
            >
              <Icon
                className="h-8 w-8 text-primary-700 dark:text-primary-300"
                strokeWidth={1.6}
                aria-hidden
              />
              <h3 className="mt-auto pt-8 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-navy dark:text-white">
                {c.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                {c.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-0.5 text-[15px] font-medium text-primary-800 group-hover:underline dark:text-primary-300">
                {c.cta}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          );
        })}
      </Reveal>
    </section>
  );
}

/**
 * «Как это работает»: три шага, соединённые линией, которая прорисовывается по
 * мере скролла (на телефоне — вертикально слева).
 */
function HowItWorks() {
  const t = useTranslations("b2c");
  const steps = ["step1", "step2", "step3"] as const;
  const listRef = useRef<HTMLOListElement | null>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 85%", "end 55%"],
  });
  const draw = useTransform(scrollYProgress, (p) => (reduce ? 1 : p));
  return (
    <section
      id="how"
      className="scroll-mt-16 bg-mist-50 py-16 dark:bg-navy-900 sm:py-24"
    >
      <Reveal className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-navy dark:text-white sm:text-[48px]">
          {t("how.title")}
        </h2>
        <ol
          ref={listRef}
          className="relative mx-auto mt-12 grid max-w-[1000px] gap-10 pl-7 sm:mt-16 sm:grid-cols-3 sm:gap-8 sm:pl-0"
        >
          {/* Линия-путь: дорожка + прорисованная часть (transform: scale). */}
          <span
            aria-hidden
            className="absolute bottom-3 left-[5px] top-3 w-px bg-mist-200 dark:bg-white/10 sm:bottom-auto sm:left-0 sm:right-[calc((100%-4rem)/3)] sm:top-[13px] sm:h-px sm:w-auto"
          />
          <motion.span
            aria-hidden
            className="absolute bottom-3 left-[5px] top-3 hidden w-px origin-top bg-primary-600 dark:bg-primary-400 max-sm:block"
            style={{ scaleY: draw }}
          />
          <motion.span
            aria-hidden
            className="absolute left-0 right-[calc((100%-4rem)/3)] top-[13px] hidden h-px origin-left bg-primary-600 dark:bg-primary-400 sm:block"
            style={{ scaleX: draw }}
          />
          {steps.map((key, i) => (
            <li key={key} className="relative">
              <span
                aria-hidden
                className="absolute -left-7 top-[9px] h-[11px] w-[11px] rounded-full border-2 border-primary-600 bg-mist-50 dark:border-primary-400 dark:bg-navy-900 sm:hidden"
              />
              <p className="text-[17px] font-semibold tabular-nums text-primary-800 dark:text-primary-300">
                {/* Подложка цвета секции «вырезает» линию под номером. */}
                <span
                  className={`relative bg-mist-50 pr-3 dark:bg-navy-900 ${
                    i > 0 ? "sm:-ml-3 sm:pl-3" : ""
                  }`}
                >
                  0{i + 1}
                </span>
              </p>
              <h3 className="mt-3 text-[21px] font-semibold leading-snug tracking-[-0.015em] text-navy dark:text-white">
                {t(`how.${key}.title`)}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                {t(`how.${key}.desc`)}
              </p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

function Faq() {
  const t = useTranslations("b2c");
  const qs = ["q1", "q2", "q3", "q4"] as const;
  return (
    <section className="py-16 sm:py-24">
      <Reveal className="mx-auto max-w-[760px] px-5 sm:px-6">
        <h2 className="text-center font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-navy dark:text-white sm:text-[48px]">
          {t("faq.title")}
        </h2>
        <div className="mt-10 divide-y divide-black/[0.08] border-y border-black/[0.08] dark:divide-white/10 dark:border-white/10 sm:mt-14">
          {qs.map((q) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium text-navy dark:text-white [&::-webkit-details-marker]:hidden">
                {t(`faq.${q}.q`)}
                <Plus
                  className="h-5 w-5 shrink-0 text-gray-500 transition-transform duration-300 ease-out group-open:rotate-45 dark:text-gray-400"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </summary>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                {t(`faq.${q}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/** Подвал как у apple.com: мелкий серый текст на тонированной полосе. */
function Footer({ locale }: { locale: string }) {
  const t = useTranslations("b2c");
  return (
    <footer className="bg-mist-50 text-[13px] dark:bg-navy-900">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-navy dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500 text-primary-950">
              <Fuel className="h-3.5 w-3.5" aria-hidden />
            </span>
            {siteConfig.appName}
          </span>
          <p className="mt-3 max-w-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {t("footer.tagline")}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-navy dark:text-white">
            {t("footer.contactsTitle")}
          </h4>
          <a
            href={`tel:${siteConfig.supportPhone}`}
            className="mt-3 inline-flex items-center gap-2 text-gray-600 hover:text-navy hover:underline dark:text-gray-400 dark:hover:text-white"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {siteConfig.supportPhone}
          </a>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold text-navy dark:text-white">
            {t("footer.docsTitle")}
          </h4>
          <div className="flex flex-col gap-2 text-gray-600 dark:text-gray-400">
            <Link
              href={`/${locale}/terms`}
              className="hover:text-navy hover:underline dark:hover:text-white"
            >
              {t("footer.terms")}
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="hover:text-navy hover:underline dark:hover:text-white"
            >
              {t("footer.privacy")}
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="mx-auto max-w-[1180px] border-t border-black/[0.08] px-5 py-5 dark:border-white/10 sm:px-6 lg:px-8">
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          © {siteConfig.appName}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
