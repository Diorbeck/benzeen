import { cn } from '@/lib/utils';

/**
 * Loading skeleton with a soft shimmer sweep (status indication, not decor).
 * The global reduced-motion block collapses the sweep to a static surface.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'skeleton-shimmer relative overflow-hidden rounded-lg bg-gray-200/60 dark:bg-white/10',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
