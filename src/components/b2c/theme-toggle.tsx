"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

// Три режима явно, а не циклической кнопкой: пользователь сразу видит, что
// доступны светлая, тёмная и системная тема, и какая включена сейчас.
// Выбор хранится next-themes (localStorage) и применяется до первой отрисовки.
const MODES = [
  { value: "light", Icon: Sun, key: "themeLight" },
  { value: "dark", Icon: Moon, key: "themeDark" },
  { value: "system", Icon: Monitor, key: "themeSystem" },
] as const;

type Mode = (typeof MODES)[number]["value"];

export function B2CThemeToggle({
  className,
  hideSystemOnMobile = false,
}: {
  className?: string;
  hideSystemOnMobile?: boolean;
}) {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // До монтирования тема неизвестна (SSR), поэтому ни одна кнопка не подсвечена —
  // иначе на гидрации подсветка «прыгала» бы.
  const current = mounted
    ? ((theme as Mode | undefined) ?? "system")
    : undefined;

  return (
    <div
      role="group"
      aria-label={t("theme")}
      className={cn(
        "flex items-center gap-0.5 rounded-control border border-gray-200 bg-gray-50 p-0.5",
        "dark:border-white/10 dark:bg-white/[0.06]",
        className,
      )}
    >
      {MODES.map(({ value, Icon, key }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            aria-label={t(key)}
            title={t(key)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
              hideSystemOnMobile && value === "system" && "hidden sm:flex",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60",
              active
                ? "bg-white text-navy shadow-sm dark:bg-white/15 dark:text-white"
                : "text-gray-500 hover:text-navy dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
