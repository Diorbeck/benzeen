'use client';

import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Fuel, Droplet, Package, Trophy, Calendar } from 'lucide-react';

type TopCompany = { name: string; liters: number; orders: number };

export function AdminOverview({
  date,
  totalLiters,
  liters92,
  liters95,
  liters100,
  ordersCount,
  topCompanies,
}: {
  date: string;
  totalLiters: number;
  liters92: number;
  liters95: number;
  liters100: number;
  ordersCount: number;
  topCompanies: TopCompany[];
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const prettyDate = (() => {
    try {
      return new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  })();

  const onDateChange = (value: string) => {
    if (!value) return;
    router.push(`${pathname}?date=${value}`);
  };

  const maxLiters = topCompanies.length > 0 ? topCompanies[0].liters : 0;

  const kpis = [
    {
      icon: Fuel,
      label: 'Продано за день, л',
      value: totalLiters.toLocaleString('ru-RU'),
      color: 'text-primary-600 dark:text-primary-400',
      bg: 'bg-primary-500/10',
    },
    {
      icon: Droplet,
      label: 'AI-92, л',
      value: liters92.toLocaleString('ru-RU'),
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Droplet,
      label: 'AI-95, л',
      value: liters95.toLocaleString('ru-RU'),
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Droplet,
      label: 'AI-100, л',
      value: liters100.toLocaleString('ru-RU'),
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-500/10',
    },
    {
      icon: Package,
      label: 'Доставок за день',
      value: String(ordersCount),
      color: 'text-petrol-500',
      bg: 'bg-petrol-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Обзор за день
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Продажи топлива за {prettyDate}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
          <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent text-sm focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-premium p-6"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {kpi.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {kpi.value}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-premium p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Топ-10 компаний за день
          </h2>
        </div>

        {topCompanies.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            За этот день доставок не было.
          </p>
        ) : (
          <div className="space-y-4">
            {topCompanies.map((c, i) => {
              const pct = maxLiters > 0 ? (c.liters / maxLiters) * 100 : 0;
              return (
                <div key={c.name + i}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-100">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500/10 text-xs font-bold text-primary-600 dark:text-primary-400">
                        {i + 1}
                      </span>
                      {c.name}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {c.liters.toLocaleString('ru-RU')} л · {c.orders} зак.
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
