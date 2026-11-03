"use client";

import { motion, useReducedMotion } from "framer-motion";
import { reveal } from "@/lib/motion";

// Спокойное появление блока при первом входе в кадр: 24px + прозрачность,
// один раз и без каскадов.
//
// Элемент всегда один и тот же motion.div: сервер не знает о reduced-motion и
// отдаёт стартовый opacity:0, а React при гидрации не чинит атрибуты — если
// подменить его обычным div, блок так и останется невидимым. Поэтому при
// reduced-motion меняется только переход: мгновенно и без сдвига.

export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reveal.initial}
      whileInView={reveal.whileInView}
      viewport={reveal.viewport}
      transition={reduce ? { duration: 0 } : reveal.transition}
    >
      {children}
    </motion.div>
  );
}
