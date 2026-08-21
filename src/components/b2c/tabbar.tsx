"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock, Home, Map, User } from "lucide-react";

// Нижний таббар мобильного приложения: Главная · Карта · Заказы · Профиль.
// Стоит на всех основных экранах; шаги оформления заказа идут без него, чтобы
// ничто не уводило из сценария. «Заказы» и «Профиль» ведут в один кабинет, но
// на разные вкладки — активная подсвечивается по параметру tab.
// useSearchParams() требует Suspense-границы при статическом пререндере
// (Next 15), иначе прод-сборка падает. Обёртка здесь — чтобы каждый экран,
// подключающий таббар, не помнил об этом сам.
export function Tabbar({ locale }: { locale: string }) {
  return (
    <Suspense fallback={null}>
      <TabbarInner locale={locale} />
    </Suspense>
  );
}

function TabbarInner({ locale }: { locale: string }) {
  const t = useTranslations("tabbar");
  const pathname = usePathname() ?? "";
  const tab = useSearchParams()?.get("tab");
  const path = pathname.replace(/^\/(ru|uz|en)/, "") || "/";

  const items = [
    { key: "home", href: `/${locale}`, icon: Home, active: path === "/" },
    {
      key: "map",
      href: `/${locale}/stations`,
      icon: Map,
      active: path.startsWith("/stations"),
    },
    {
      key: "orders",
      href: `/${locale}/account?tab=history`,
      icon: Clock,
      active:
        (path.startsWith("/account") && tab === "history") ||
        path.startsWith("/account/orders"),
    },
    {
      key: "profile",
      href: `/${locale}/account`,
      icon: User,
      active: path.startsWith("/account") && tab !== "history" && !path.startsWith("/account/orders"),
    },
  ] as const;

  return (
    <nav
      aria-label={t("home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-paper-300 bg-white/95 backdrop-blur dark:border-navy-700 dark:bg-navy-900/95"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {items.map(({ key, href, icon: Icon, active }) => (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 px-3 pb-1 pt-2 text-[11px] font-medium transition-colors active:scale-95 ${
              active
                ? "text-primary-800 dark:text-primary-500"
                : "text-gray-500 hover:text-navy dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
            {t(key)}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Высота таббара — для отступов контента под ним. */
export const TABBAR_SPACE = "pb-[calc(3.5rem+env(safe-area-inset-bottom))]";
