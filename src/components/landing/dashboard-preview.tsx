'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

const mockRows = [
  { vehicle: 'TRK-102', fuelUsed: '45 L', remaining: '120 L', status: 'active' as const },
  { vehicle: 'TRK-215', fuelUsed: '32 L', remaining: '80 L', status: 'pending' as const },
  { vehicle: 'TRK-088', fuelUsed: '78 L', remaining: '122 L', status: 'active' as const },
  { vehicle: 'TRK-411', fuelUsed: '12 L', remaining: '188 L', status: 'active' as const },
];

const chartHeights = [65, 40, 85, 55, 70, 45, 90];

export function DashboardPreview() {
  const t = useTranslations('dashboardPreview');

  return (
    <section
      id="dashboard-preview"
      className="relative border-b border-gray-200 dark:border-white/5 py-24 transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl transition-colors duration-300">
            {t('title')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600 dark:text-gray-400 transition-colors duration-300">{t('subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-gray-900/80 dark:shadow-2xl transition-colors duration-300"
        >
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500/80" />
              <span className="h-2 w-2 rounded-full bg-amber-500/80" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
            </div>
            <span className="ml-2 text-xs text-gray-500">NeoOil · Fleet dashboard</span>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-3">
            <div className="lg:col-span-2 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-white/10">
                    <th className="pb-3 pr-4">{t('tableVehicle')}</th>
                    <th className="pb-3 pr-4">{t('tableFuelUsed')}</th>
                    <th className="pb-3 pr-4">{t('tableRemaining')}</th>
                    <th className="pb-3">{t('tableStatus')}</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {mockRows.map((row, i) => (
                    <motion.tr
                      key={row.vehicle}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-gray-100 transition hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{row.vehicle}</td>
                      <td className="py-3 pr-4">{row.fuelUsed}</td>
                      <td className="py-3 pr-4">{row.remaining}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            row.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {row.status === 'active' ? t('statusActive') : t('statusPending')}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('chartTitle')}
              </p>
              <div className="flex h-32 items-end gap-2">
                {chartHeights.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.4 }}
                    className="flex-1 rounded-t bg-primary-500/60"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
