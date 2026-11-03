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
// фирменный индикатор бака: на десктопе — тонкая вертикальная шкала у правого
// края, на телефоне — тонкая полоса под верхней кромкой. Вниз — бак пустеет,
// вверх — наполняется; у дна страницы мягкий «долив».
//
// Всё — transform на motion values: React не ре-рендерится на скролле, кадры
// не теряются. Слой без pointer-events. При prefers-reduced-motion бак полный.

export function ScrollJourney() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const level = useTankLevel(scrollYProgress, !reduce);
  return <TankGauge level={reduce ? 1 : level} />;
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
