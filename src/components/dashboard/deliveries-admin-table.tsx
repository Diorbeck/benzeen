'use client';

import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';

type Row = {
  id: string;
  company: string;
  plateNumber: string;
  fuelType: string;
  volume: number;
  deliveredAt: string;
};

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export function DeliveriesAdminTable({ rows }: { rows: Row[] }) {
  const [month, setMonth] = useState('all');

  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => monthKey(r.deliveredAt)))).sort().reverse(),
    [rows],
  );

  const filtered = useMemo(
    () => (month === 'all' ? rows : rows.filter((r) => monthKey(r.deliveredAt) === month)),
    [rows, month],
  );

  const totalLiters = filtered.reduce((s, r) => s + (r.volume || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="all">Все месяцы</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Доставок: <span className="font-semibold text-gray-900 dark:text-white">{filtered.length}</span>
          {' · '}
          Литров: <span className="font-semibold text-gray-900 dark:text-white">{totalLiters}</span>
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="card-premium flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-2xl bg-primary-500/10 p-4">
            <Package className="h-10 w-10 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Завершённых доставок нет.</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200/60 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-white/[0.07] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Доставлен</th>
                  <th className="px-4 py-3">Компания</th>
                  <th className="px-4 py-3">Машина</th>
                  <th className="px-4 py-3">Топливо</th>
                  <th className="px-4 py-3 text-right">Литры</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100/80 last:border-0 hover:bg-gray-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(r.deliveredAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.company}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.plateNumber}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.fuelType.replace('_', '-')}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{r.volume}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        Доставлен
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
