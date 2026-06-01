'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Row = {
  id: string;
  company: string;
  plateNumber: string;
  fuelType: string;
  volume: number;
  status: string;
  address: string | null;
  createdAt: string;
  deliveredAt: string | null;
  createdBy: string | null;
  courier: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Создан',
  RECEIVED: 'Принят',
  PENDING_APPROVAL: 'На согласовании',
  ASSIGNED: 'Назначен',
  COURIER_ASSIGNED: 'Назначен курьер',
  ON_ROUTE: 'В пути',
  IN_DELIVERY: 'В пути',
  DELIVERED: 'Доставлен',
  CLOSED: 'Закрыт',
  REJECTED: 'Отклонён',
  CANCELLED: 'Отменён',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
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

export function HistoryTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.company} ${r.plateNumber} ${r.address ?? ''} ${r.courier ?? ''} ${r.createdBy ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom && new Date(r.createdAt) < new Date(dateFrom + 'T00:00:00')) return false;
      if (dateTo && new Date(r.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [rows, search, statusFilter, dateFrom, dateTo]);

  const csvCell = (value: string | number) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = () => {
    const headers = [
      'Компания',
      'Машина',
      'Топливо',
      'Литры',
      'Статус',
      'Адрес',
      'Создан',
      'Доставлен',
      'Создал',
      'Курьер',
    ];
    const body = filtered.map((r) => [
      r.company,
      r.plateNumber,
      r.fuelType.replace('_', '-'),
      r.volume,
      STATUS_LABEL[r.status] || r.status,
      r.address ?? '',
      fmtDate(r.createdAt),
      fmtDate(r.deliveredAt),
      r.createdBy ?? '',
      r.courier ?? '',
    ]);
    const csv = [headers, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'history-all.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: компания, машина, адрес…"
              className="h-9 w-64 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="all">Все статусы</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] || s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Экспорт CSV
        </Button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Записей: <span className="font-semibold text-gray-900 dark:text-white">{filtered.length}</span>
      </p>

      {filtered.length === 0 ? (
        <div className="card-premium flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-2xl bg-primary-500/10 p-4">
            <Package className="h-10 w-10 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ничего не найдено.</p>
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
                  <th className="px-4 py-3">Компания</th>
                  <th className="px-4 py-3">Машина</th>
                  <th className="px-4 py-3">Топливо</th>
                  <th className="px-4 py-3 text-right">Литры</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Создан</th>
                  <th className="px-4 py-3">Доставлен</th>
                  <th className="px-4 py-3">Курьер</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100/80 last:border-0 hover:bg-gray-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.company}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.plateNumber}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.fuelType.replace('_', '-')}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{r.volume}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{STATUS_LABEL[r.status] || r.status}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(r.deliveredAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{r.courier ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
