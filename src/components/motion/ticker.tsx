"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { duration, easeOut } from "@/lib/motion";

// Цифра, которая «перетекает»: при первом появлении в кадре набегает от нуля,
// при смене значения — плавно идёт от старого к новому. Текст обновляет
// framer-motion напрямую в DOM, без ре-рендеров React на каждом кадре.
// Скринридер читает только итоговое значение; при reduced-motion — сразу оно.

export function Ticker({
  value,
  format = String,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const mv = useMotionValue(reduce ? value : 0);
  const formatRef = useRef(format);
  formatRef.current = format;
  const text = useTransform(mv, (v) => formatRef.current(Math.round(v)));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, {
      duration: duration.ticker,
      ease: easeOut,
    });
    return () => controls.stop();
  }, [value, inView, reduce, mv]);

  return (
    <span ref={ref} className={className}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
