"use client";

import { ArrowLeft } from "lucide-react";

// Каркас мобильного шага заправки: кнопка «назад» сверху, контент, одна главная
// кнопка, прижатая к низу с учётом safe-area iPhone. Все экраны сценария
// «заправка на АЗС» собраны из этого каркаса, чтобы жесты и отступы совпадали.
//
// Высота — ровно 100dvh (динамическая: в мобильном Safari вьюпорт плавает при
// показе/скрытии адресной строки, и на vh низ уезжал бы под панель). Скроллится
// только средняя часть: шапка с названием АЗС и нижняя кнопка стоят на месте,
// поэтому заголовок не срезается, а «Далее» всегда доступна без скролла.
export function FlowShell({
  title,
  subtitle,
  onBack,
  backAria,
  step,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backAria: string;
  /** Позиция в сценарии: «Шаг 1 из 3» + тонкая полоса прогресса под шапкой. */
  step?: { current: number; total: number; label: string };
  /** Главная кнопка экрана — закреплена внизу поверх контента. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <header className="relative shrink-0 border-b border-paper-300 bg-canvas dark:border-navy-700 dark:bg-navy-950">
        <div className="flex items-center gap-1 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            aria-label={backAria}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-navy transition-colors hover:bg-gray-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:text-white dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {subtitle}
              </p>
            )}
          </div>
          {step && (
            <span className="mr-2 shrink-0 rounded-md bg-primary-500/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary-800 dark:bg-primary-500/15 dark:text-primary-500">
              {step.label}
            </span>
          )}
        </div>
        {step && (
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-500 transition-[width] duration-300"
            style={{ width: `${Math.round((step.current / step.total) * 100)}%` }}
            role="presentation"
          />
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-4">
          {children}
        </div>
      </main>

      {action && (
        <div className="shrink-0 border-t border-paper-300 bg-canvas dark:border-navy-700 dark:bg-navy-950">
          <div className="mx-auto w-full max-w-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {action}
          </div>
        </div>
      )}
    </div>
  );
}
