'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function OrdersTableSkeleton() {
  return (
    <div className="card-premium overflow-hidden">
      <div className="border-b border-gray-200/60 px-6 py-4 dark:border-white/[0.07]">
        <div className="flex gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200/60 dark:border-white/[0.07]">
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} className="px-6 py-4">
                  <Skeleton className="h-4 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <tr key={row} className="border-b border-gray-100/80 last:border-0 dark:border-white/[0.04]">
                {[1, 2, 3, 4, 5].map((cell) => (
                  <td key={cell} className="px-6 py-4">
                    <Skeleton className="h-4 w-full max-w-[80px]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
