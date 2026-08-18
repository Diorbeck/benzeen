import { cn } from '@/lib/utils';

/**
 * Знак Benzeen: капля топлива, вырезанная стрелкой движения — «топливо, которое
 * приезжает». Геометрия строится на сетке 32×32, поэтому знак читается и в
 * favicon 16px, и на баннере. Цвет наследуется от currentColor, чтобы одна
 * разметка работала в светлой и тёмной теме без дублирования.
 */
export function BenzeenMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('h-full w-full', className)}
      aria-hidden
    >
      {/* Капля: вершина по центру, тело — скруглённый треугольник. */}
      <path
        d="M16 3.5c5.6 6.2 8.9 10.6 8.9 14.7 0 5.1-4 8.8-8.9 8.8s-8.9-3.7-8.9-8.8C7.1 14.1 10.4 9.7 16 3.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Стрелка внутри капли — вектор доставки. */}
      <path
        d="M13 20.4 19 13.2h-4.2l1.6-4.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Логотип с названием. `size="lg"` — для шапки главной, где владелец просил
 * крупное выразительное написание; `size="sm"` — для футера и служебных экранов.
 */
export function BenzeenLogo({
  size = 'lg',
  className,
}: {
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const box = size === 'lg' ? 'h-9 w-9 sm:h-11 sm:w-11' : 'h-8 w-8';
  const mark = size === 'lg' ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4';
  const text = size === 'lg' ? 'text-xl sm:text-[26px]' : 'text-base';

  return (
    <span className={cn('flex shrink-0 items-center gap-2 sm:gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-control bg-primary-600 text-white',
          'dark:bg-primary-500 dark:text-white',
          box,
        )}
      >
        <BenzeenMark className={mark} />
      </span>
      <span
        className={cn(
          'whitespace-nowrap font-display font-bold tracking-[-0.02em] text-navy dark:text-white',
          text,
        )}
      >
        Benzeen
      </span>
    </span>
  );
}
