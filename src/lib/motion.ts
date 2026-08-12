/**
 * Motion tokens (Uber-restraint): «незаметность = качество».
 * Разрешено: направленные переходы шагов, шиты 200мс, skeleton, pulse курьера.
 * Запрещено: стаггеры, каскады, fade+rise по скроллу, count-up.
 * prefers-reduced-motion гасит и разрешённое (MotionConfig + globals.css).
 */

/** Длительности в секундах (framer-motion) — ×1000 для CSS. */
export const duration = {
  fast: 0.15,
  base: 0.2,
} as const;

export const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export const spring = {
  /** Направленные переходы шагов и мелкие state-попы. */
  default: { duration: 0.2, ease: easeOut },
  /** Нижние шиты: 200мс, без пружин и отскока. */
  sheet: { duration: 0.2, ease: easeOut },
  /** Мгновенный отклик выбора. */
  snappy: { duration: 0.15, ease: easeOut },
} as const;

/** Оставлено для совместимости; новые появления по скроллу не строить. */
export const fadeRise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

export const stagger = 0;
