import { Fuel } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Знак Benzeen — прежний: топливный пистолет в синем квадрате. Владелец просил
 * вернуть именно его, поэтому рисованная капля-стрелка убрана.
 *
 * Логотип с названием. `size="lg"` — для шапки главной, где владелец просил
 * крупное выразительное написание; `size="sm"` — для футера и служебных экранов.
 */
export function BenzeenLogo({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "h-9 w-9 sm:h-11 sm:w-11" : "h-8 w-8";
  const mark = size === "lg" ? "h-5 w-5 sm:h-6 sm:w-6" : "h-4 w-4";
  const text = size === "lg" ? "text-xl sm:text-[26px]" : "text-base";

  return (
    <span
      className={cn("flex shrink-0 items-center gap-2 sm:gap-2.5", className)}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-control bg-primary-600 text-white",
          "dark:bg-primary-500 dark:text-white",
          box,
        )}
      >
        <Fuel className={mark} aria-hidden />
      </span>
      <span
        className={cn(
          "whitespace-nowrap font-display font-bold tracking-[-0.02em] text-navy dark:text-white",
          text,
        )}
      >
        Benzeen
      </span>
    </span>
  );
}
