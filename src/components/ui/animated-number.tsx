'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

/**
 * Count-up number: springs from the previous value to the new one.
 * Formats via the provided formatter (locale-aware), renders tabular-nums so
 * digits don't jitter. Reduced motion → snaps instantly.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { bounce: 0, duration: 500 });
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (reduced) {
      spring.jump(value);
    } else {
      mv.set(value);
    }
  }, [value, reduced, mv, spring]);

  useEffect(
    () =>
      spring.on('change', (v) => {
        if (ref.current) ref.current.textContent = formatRef.current(Math.round(v));
      }),
    [spring],
  );

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(value)}
    </span>
  );
}
