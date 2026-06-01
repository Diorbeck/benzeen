'use client';

import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function UsageChartClient({
  data,
}: {
  data?: {
    perMonth?: { label: string; used: number }[];
    byFuelType?: { AI_92?: number; AI_95?: number; AI_100?: number };
  };
}) {
  const t = useTranslations('dashboard.chart');
  const perMonth = data?.perMonth ?? [];
  const byFuel = data?.byFuelType ?? { AI_92: 0, AI_95: 0, AI_100: 0 };

  if (
    perMonth.length === 0 &&
    (byFuel.AI_92 ?? 0) === 0 &&
    (byFuel.AI_95 ?? 0) === 0 &&
    (byFuel.AI_100 ?? 0) === 0
  ) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-white/10">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={perMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Bar dataKey="used" fill="rgb(37 99 235 / 0.8)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {(byFuel.AI_92 ?? 0) > 0 || (byFuel.AI_95 ?? 0) > 0 || (byFuel.AI_100 ?? 0) > 0 ? (
        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            AI-92: {byFuel.AI_92 ?? 0} л
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary-500" />
            AI-95: {byFuel.AI_95 ?? 0} л
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            AI-100: {byFuel.AI_100 ?? 0} л
          </span>
        </div>
      ) : null}
    </div>
  );
}
