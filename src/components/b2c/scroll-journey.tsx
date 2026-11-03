"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { easeOut, tankRefillAt, tankSpring } from "@/lib/motion";

// Скролл-анимация главной — метафора продукта: страница «заправляется» вместе
// с пользователем.
//
//   • фирменный индикатор бака: на десктопе — тонкая вертикальная шкала у
//     правого края, на телефоне — тонкая полоса под верхней кромкой. Вниз —
//     бак пустеет, вверх — наполняется; у дна страницы мягкий «долив»;
//   • (десктоп) силуэт машины едет вниз по фону к заправке в самом низу.
//
// Всё — transform/opacity на motion values: React не ре-рендерится на скролле,
// кадры не теряются. Слой без pointer-events, заказу не мешает. При
// prefers-reduced-motion — статика: бак полный, машины нет.

export function ScrollJourney() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const level = useTankLevel(scrollYProgress, !reduce);

  // Машина идёт от верхней кромки до площадки заправки внизу экрана.
  const carY = useTransform(scrollYProgress, (p) => `${12 + p * 62}vh`);
  const trail = useTransform(scrollYProgress, (p) => p);
  // Станция «проявляется» на последней четверти пути — до этого она за кадром.
  const stationIn = useTransform(scrollYProgress, [0.72, 1], [0, 1]);

  return (
    <>
      <TankGauge level={reduce ? 1 : level} />
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 hidden select-none lg:block"
        >
          {/* Полоса дороги, по которой идёт машина. */}
          <div className="absolute inset-y-0 left-[68px] w-px bg-navy/[0.05] dark:bg-white/[0.05]" />
          <motion.div
            className="absolute inset-y-0 left-[68px] w-px origin-top bg-primary-500/25"
            style={{ scaleY: trail }}
          />

          {/* Силуэт машины: темнее фона, без деталей — это фон, а не иллюстрация. */}
          <motion.div
            className="absolute left-[68px] top-0 -ml-12 text-navy/[0.12] dark:text-white/[0.10]"
            style={{ y: carY }}
          >
            <CarSilhouette />
          </motion.div>

          {/* Заправка в самом низу: машина приезжает к ней в конце страницы. */}
          <motion.div
            className="absolute bottom-6 left-3 text-navy/[0.13] dark:text-white/[0.12]"
            style={{ opacity: stationIn }}
          >
            <StationSilhouette />
          </motion.div>
        </div>
      )}
    </>
  );
}

/**
 * Уровень бака 0..1: следует за скроллом через жёсткую пружину (без лага, но
 * без ступенек от колеса мыши), а у дна страницы плавно доливается до полного.
 */
function useTankLevel(
  progress: MotionValue<number>,
  enabled: boolean,
) {
  const follow = useSpring(
    useTransform(progress, (p) => 1 - p),
    tankSpring,
  );
  const refill = useMotionValue(0);
  const refilled = useRef(false);
  const anim = useRef<AnimationPlaybackControls | null>(null);

  useMotionValueEvent(progress, "change", (p) => {
    if (!enabled) return;
    const atBottom = p >= tankRefillAt;
    if (atBottom === refilled.current) return;
    refilled.current = atBottom;
    anim.current?.stop();
    anim.current = animate(refill, atBottom ? 1 : 0, {
      duration: atBottom ? 1.1 : 0.45,
      ease: easeOut,
    });
  });

  useEffect(() => () => anim.current?.stop(), []);

  return useTransform([follow, refill], ([f, r]: number[]) =>
    Math.max(0, Math.min(1, f + (1 - f) * r)),
  );
}

function TankGauge({
  level,
}: {
  level: number | MotionValue<number>;
}) {
  return (
    <div aria-hidden className="pointer-events-none select-none">
      {/* Телефон: тонкая полоса у верхней кромки, поверх шапки. */}
      <div
        className="fixed inset-x-0 z-[51] h-[3px] bg-navy/[0.06] dark:bg-white/[0.08] lg:hidden"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <motion.div
          className="h-full origin-left bg-primary-600 dark:bg-primary-400"
          style={{ scaleX: level }}
        />
      </div>

      {/* Десктоп: вертикальная шкала у правого края. */}
      <div className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-2 lg:flex xl:right-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/30 dark:text-white/30">
          F
        </span>
        <div className="relative h-44 w-1.5 overflow-hidden rounded-full bg-navy/[0.08] dark:bg-white/[0.08]">
          <motion.div
            className="absolute inset-0 origin-bottom bg-primary-600 dark:bg-primary-400"
            style={{ scaleY: level }}
          />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/30 dark:text-white/30">
          E
        </span>
      </div>
    </div>
  );
}

function CarSilhouette() {
  return (
    <svg width="96" height="78" viewBox="0 0 120 98" fill="currentColor">
      {/* Вид сверху, машина едет вниз: кузов сужается к капоту, по бокам колёса,
          вырезы стёкол делают пятно узнаваемым автомобилем. */}
      <path d="M60 4c13 0 21 6 24 16l4 16c2 8 3 17 3 26s-1 18-3 26l-3 5c-2 3-6 5-11 5H46c-5 0-9-2-11-5l-3-5c-2-8-3-17-3-26s1-18 3-26l4-16C39 10 47 4 60 4Z" />
      <rect x="20" y="26" width="11" height="20" rx="5" />
      <rect x="89" y="26" width="11" height="20" rx="5" />
      <rect x="20" y="58" width="11" height="20" rx="5" />
      <rect x="89" y="58" width="11" height="20" rx="5" />
      {/* Стёкла — вырезы фоном, поэтому силуэт остаётся плоским и приглушённым. */}
      <path
        d="M46 28h28l4 12H42l4-12Z"
        fill="var(--journey-cut)"
        opacity="0.55"
      />
      <path
        d="M43 76h34l-3 9H46l-3-9Z"
        fill="var(--journey-cut)"
        opacity="0.4"
      />
    </svg>
  );
}

function StationSilhouette() {
  return (
    <svg width="176" height="120" viewBox="0 0 220 150" fill="currentColor">
      {/* Навес на двух опорах, под ним колонка — читаемый силуэт АЗС. */}
      <rect x="0" y="10" width="220" height="16" rx="8" />
      <rect x="14" y="26" width="12" height="118" rx="6" />
      <rect x="194" y="26" width="12" height="118" rx="6" />
      <rect x="63" y="72" width="44" height="72" rx="10" />
      <rect x="73" y="84" width="24" height="20" rx="5" opacity="0.45" />
      <rect x="0" y="144" width="220" height="6" rx="3" />
    </svg>
  );
}
