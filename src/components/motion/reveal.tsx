"use client";

import { motion, useReducedMotion } from "framer-motion";
import { reveal } from "@/lib/motion";

// Едва заметное появление блока при первом входе в кадр: 10px + прозрачность,
// 220мс, один раз и без каскадов. При reduced-motion блок просто на месте.

export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} {...reveal}>
      {children}
    </motion.div>
  );
}
