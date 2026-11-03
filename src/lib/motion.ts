/**
 * Motion tokens — «живой, но незаметный» интерфейс.
 * Движение функциональное: показывает уровень, маршрут, отклик на выбор.
 * Только transform/opacity (и canvas карты), 60fps, без каскадов.
 * prefers-reduced-motion гасит всё (MotionConfig + globals.css + проверки в
 * компонентах): бак полный, шкалы на реальном уровне, цифры сразу итоговые.
 */

/** Длительности в секундах (framer-motion) — ×1000 для CSS. */
export const duration = {
  fast: 0.15,
  base: 0.2,
  /** Появление секции: едва заметно, ≤250мс. */
  reveal: 0.22,
  /** Тикер цифр с датчиков и сумма заказа. */
  ticker: 0.6,
  /** Прорисовка линии маршрута на карте. */
  route: 0.9,
} as const;

export const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export const spring = {
  /** Направленные переходы шагов и мелкие state-попы. */
  default: { duration: 0.2, ease: easeOut },
  /** Нижние шиты: 200мс, без пружин и отскока. */
  sheet: { duration: 0.2, ease: easeOut },
  /** Мгновенный отклик выбора. */
  snappy: { duration: 0.15, ease: easeOut },
  /** Индикатор выбранного чипа: перетекает к новому, без отскока. */
  chip: { type: "spring", stiffness: 520, damping: 42, mass: 0.6 },
  /** Магнитный ховер главного CTA — мягкое притяжение и возврат. */
  magnet: { stiffness: 260, damping: 18, mass: 0.4 },
} as const;

/** Пружина уровня бака: держится за скролл, но сглаживает рывки колеса. */
export const tankSpring = { stiffness: 320, damping: 40, mass: 0.35 } as const;

/** Доля страницы, после которой бак мягко «доливается» до полного. */
export const tankRefillAt = 0.985;

/** Появление секций: сдвиг 10px + прозрачность, один раз. */
export const reveal = {
  initial: { opacity: 0, y: 10 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "0px 0px -10% 0px" },
  transition: { duration: duration.reveal, ease: easeOut },
} as const;

/** Максимальный сдвиг магнитной кнопки, px. */
export const magnetMaxShift = 6;

/** Оставлено для совместимости. */
export const fadeRise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

export const stagger = 0;
