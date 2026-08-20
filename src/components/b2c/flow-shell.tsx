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
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backAria: string;
  /** Главная кнопка экрана — закреплена внизу поверх контента. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <header className="flex shrink-0 items-center gap-1 border-b border-paper-300 bg-canvas px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] dark:border-navy-700 dark:bg-navy-950">
        <button
          type="button"
          onClick={onBack}
          aria-label={backAria}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-navy transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/60 dark:text-white dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
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
