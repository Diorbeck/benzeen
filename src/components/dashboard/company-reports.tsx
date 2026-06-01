'use client';

import { motion } from 'framer-motion';
import { Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Row = { id: string; name: string; ai92: number; ai95: number; ai100: number; total: number };

export function CompanyReports({ rows }: { rows: Row[] }) {
  const totalAi92 = rows.reduce((s, r) => s + r.ai92, 0);
  const totalAi95 = rows.reduce((s, r) => s + r.ai95, 0);
  const totalAi100 = rows.reduce((s, r) => s + r.ai100, 0);

  const csvCell = (value: string | number) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = () => {
    const headers = ['Компания', 'AI-92, л', 'AI-95, л', 'AI-100, л', 'Всего, л'];
    const body = rows.map((r) => [r.name, r.ai92, r.ai95, r.ai100, r.total]);
    const csv = [headers, ...body, ['Итого', totalAi92, totalAi95, totalAi100, totalAi92 + totalAi95 + totalAi100]]
      .map((r) => r.map(csvCell).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'report-by-company.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>
            Всего AI-92:{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalAi92.toLocaleString('ru-RU')} л
            </span>
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>
            Всего AI-95:{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalAi95.toLocaleString('ru-RU')} л
            </span>
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>
            Всего AI-100:{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalAi100.toLocaleString('ru-RU')} л
            </span>
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Экспорт CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="card-premium flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-2xl bg-primary-500/10 p-4">
            <BarChart3 className="h-10 w-10 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Пока нет компаний.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-premium overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/60 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-white/[0.07] dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Компания</th>
                  <th className="px-6 py-4 text-right">AI-92, л</th>
                  <th className="px-6 py-4 text-right">AI-95, л</th>
                  <th className="px-6 py-4 text-right">AI-100, л</th>
                  <th className="px-6 py-4 text-right">Всего, л</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100/80 last:border-0 hover:bg-gray-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {r.name}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400">
                      {r.ai92.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-right text-amber-600 dark:text-amber-400">
                      {r.ai95.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-right text-sky-600 dark:text-sky-400">
                      {r.ai100.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                      {r.total.toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200/60 bg-gray-50/60 font-semibold dark:border-white/[0.07] dark:bg-white/[0.02]">
                  <td className="px-6 py-4 text-gray-900 dark:text-white">Итого</td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                    {totalAi92.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                    {totalAi95.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                    {totalAi100.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                    {(totalAi92 + totalAi95 + totalAi100).toLocaleString('ru-RU')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
