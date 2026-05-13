'use client';

import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { formatUzs } from '@/lib/utils';

const months = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export function InvoicesList({
  invoices,
}: {
  invoices: { id: string; month: number; year: number; totalUzs: number; paidAt: Date | null }[];
}) {
  return (
    <div className="space-y-4">
      {invoices.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-premium flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6 rounded-2xl bg-primary-500/10 p-5">
            <FileText className="h-14 w-14 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Нет счетов
          </h3>
          <p className="mt-2 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">
            Счета формируются ежемесячно. Здесь появятся ваши счета за топливо
          </p>
        </motion.div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5">
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Период
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Сумма
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-gray-100 last:border-0 dark:border-white/5"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {months[inv.month]} {inv.year}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {formatUzs(inv.totalUzs)}
                    </td>
                    <td className="px-6 py-4">
                      {inv.paidAt ? (
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                          Оплачен
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          Ожидает
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
