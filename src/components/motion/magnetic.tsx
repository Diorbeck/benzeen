"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { magnetMaxShift, spring } from "@/lib/motion";
import { useMediaQuery } from "./use-media-query";

// Магнитный ховер главного CTA: кнопка чуть тянется за курсором (до 6px) и
// пружиной возвращается на место. Только десктоп с мышью — на тач-экранах и
// при reduced-motion обёртка ничего не делает.

export function Magnetic({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const fine = useMediaQuery(
    "(hover: hover) and (pointer: fine) and (min-width: 1024px)",
  );
  const enabled = fine && !reduce;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring.magnet);
  const sy = useSpring(y, spring.magnet);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!enabled || !el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    // По горизонтали тянем слабее: кнопка широкая, иначе уезжает заметно.
    x.set(clamp(dx) * magnetMaxShift * 0.6);
    y.set(clamp(dy) * magnetMaxShift * 0.5);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={enabled ? { x: sx, y: sy } : undefined}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  );
}
