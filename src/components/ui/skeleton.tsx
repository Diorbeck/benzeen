import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-200/60 dark:bg-white/10', className)}
      {...props}
    />
  );
}

export { Skeleton };
