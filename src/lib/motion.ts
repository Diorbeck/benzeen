/**
 * Motion tokens — the single source of animation constants (benzeen-design).
 *
 * Rules: animate only transform/opacity; hover/color feedback via CSS with
 * `duration.fast`/`duration.base`; entrances and movement via springs.
 * Bounce is reserved for surfaces that carry gesture momentum (bottom sheets).
 * `prefers-reduced-motion` is honored globally (MotionConfig + globals.css).
 */

/** Durations in seconds (framer-motion) — ×1000 for CSS. */
export const duration = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
} as const;

/** Ease-out for the rare tween (color, opacity-only fades). */
export const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export const spring = {
  /** Default UI spring: critically damped, no overshoot. */
  default: { type: 'spring', bounce: 0, duration: 0.35 },
  /** Bottom sheets and anything released with momentum. */
  sheet: { type: 'spring', bounce: 0.15, duration: 0.4 },
  /** Small feedback: chips, toggles, selection. */
  snappy: { type: 'spring', bounce: 0, duration: 0.25 },
} as const;

/** Standard entrance: fade + rise. Use with `transition={spring.default}`. */
export const fadeRise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
} as const;

/** Stagger interval between sibling entrances, seconds. */
export const stagger = 0.06;
