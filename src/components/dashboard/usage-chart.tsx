'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

const UsageChartClient = dynamic(() => import('./usage-chart-client'), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
});

export function UsageChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-usage'],
    queryFn: async () => {
      const r = await fetch('/api/analytics/usage');
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full rounded-xl" />;
  }

  return <UsageChartClient data={data} />;
}
