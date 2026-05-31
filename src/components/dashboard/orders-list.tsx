'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Download } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatUzs } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const STATUS_KEYS: Record<string, string> = {
  CREATED: 'created',
  RECEIVED: 'received',
  COURIER_ASSIGNED: 'courierAssigned',
  IN_DELIVERY: 'inDelivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  PENDING_APPROVAL: 'pendingApproval',
  ASSIGNED: 'courierAssigned',
  ON_ROUTE: 'inDelivery',
  CLOSED: 'delivered',
  REJECTED: 'cancelled',
};

type OrderRow = {
  id: string;
  volume: number;
  status: string;
  fuelType: string;
  plateNumber: string;
  createdAt: Date;
  address?: string | null;
  driverName?: string | null;
};

const DELIVERY_STATUSES = ['COURIER_ASSIGNED', 'IN_DELIVERY', 'DELIVERED', 'ASSIGNED', 'ON_ROUTE'];

export function OrdersList({
  orders,
  role,
  defaultStatusFilter,
  pageTitle,
}: {
  orders: OrderRow[];
  role?: string;
  defaultStatusFilter?: string;
  pageTitle?: string;
}) {
  const t = useTranslations('orders');
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'ru';
  const canCreate = role === 'DRIVER';
  const canExport = role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN';
  const isCourier = role === 'COURIER';
  const isCompany = role === 'COMPANY_ADMIN';
  const canAssignOrUpdate = role === 'DISPATCHER' || role === 'SUPER_ADMIN';

  const [statusFilter, setStatusFilter] = useState<string>(defaultStatusFilter ?? 'all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [courierOrders, setCourierOrders] = useState<OrderRow[] | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const showVehicleDriverFilters = role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER';

  useEffect(() => {
    if (!isCourier) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/courier/orders');
        if (!res.ok) return;
        const data: { id: string; plateNumber: string; fuelType: string; volume: number; status: string; address?: string | null; createdAt: string }[] =
          await res.json();
        if (cancelled) return;
        setCourierOrders(
          data.map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt),
          })),
        );
      } catch {
        // ignore
      }
    };

    load();
    const id = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isCourier]);

  useEffect(() => {
    const loadPrices = async () => {
      try {
        const res = await fetch('/api/prices');
        if (!res.ok) return;
        const data: { fuelType: string; priceUzs: number }[] = await res.json();
        const map: Record<string, number> = {};
        for (const p of data) map[p.fuelType] = p.priceUzs;
        setPrices(map);
      } catch {
        // ignore
      }
    };
    loadPrices();
  }, []);

  const sourceOrders = isCourier && courierOrders ? courierOrders : orders;

  const filteredOrders = useMemo(() => {
    return sourceOrders.filter((o) => {
      if (statusFilter === 'deliveries') {
        if (!DELIVERY_STATUSES.includes(o.status)) return false;
      } else if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (productFilter !== 'all' && o.fuelType !== productFilter) return false;
      if (vehicleFilter !== 'all' && o.plateNumber !== vehicleFilter) return false;
      if (driverFilter !== 'all') {
        const name = (o.driverName ?? '').trim() || '—';
        if (name !== driverFilter) return false;
      }
      if (dateFrom) {
        const d = new Date(o.createdAt);
        if (d < new Date(dateFrom + 'T00:00:00')) return false;
      }
      if (dateTo) {
        const d = new Date(o.createdAt);
        if (d > new Date(dateTo + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [sourceOrders, statusFilter, productFilter, vehicleFilter, driverFilter, dateFrom, dateTo]);

  const uniqueVehicles = useMemo(() => Array.from(new Set(sourceOrders.map((o) => o.plateNumber))).sort(), [sourceOrders]);
  const uniqueDrivers = useMemo(
    () => Array.from(new Set(sourceOrders.map((o) => (o.driverName ?? '').trim() || '—'))).filter(Boolean).sort(),
    [sourceOrders],
  );

  const totalLiters = filteredOrders.reduce((sum, o) => sum + (o.volume || 0), 0);
  const totalSum =
    filteredOrders.reduce(
      (sum, o) => sum + (prices[o.fuelType] || 0) * (o.volume || 0),
      0,
    ) || 0;

  const handleDispatcherStatus = async (orderId: string, status: string) => {
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (typeof window !== 'undefined') window.location.reload();
    } catch {
      // ignore
    }
  };

  const handleAssignCourier = async (orderId: string) => {
    const courierId = typeof window !== 'undefined' ? window.prompt(t('enterCourierId')) : null;
    if (!courierId?.trim()) return;
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COURIER_ASSIGNED', assignedToId: courierId.trim() }),
      });
      if (typeof window !== 'undefined') window.location.reload();
    } catch {
      // ignore
    }
  };

  const handleCourierAction = async (orderId: string, action: 'TAKE' | 'ON_ROUTE' | 'DELIVERED') => {
    let volume: number | undefined;
    if (action === 'DELIVERED') {
      if (typeof window === 'undefined') return;
      const input = window.prompt(t('promptVolume'));
      if (!input) return;
      const parsed = parseInt(input, 10);
      if (!parsed || parsed <= 0) return;
      volume = parsed;
    }
    try {
      await fetch(`/api/courier/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, volume }),
      });
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      // ignore
    }
  };

  const csvCell = (value: string | number) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = () => {
    const headers = [
      t('table.plate'),
      t('table.volume'),
      t('table.fuel'),
      t('table.date'),
      t('table.address'),
    ];
    const rows = filteredOrders.map((o) => [
      o.plateNumber,
      o.volume,
      o.fuelType.replace('_', '-'),
      new Date(o.createdAt).toISOString().slice(0, 10),
      o.address ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(csvCell).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders-${dateFrom || 'all'}-${dateTo || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!isCompany && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="all">{t('filters.status')}</option>
            <option value="deliveries">{t('filters.deliveries')}</option>
            {Object.keys(STATUS_KEYS).map((s) => (
              <option key={s} value={s}>
                {t('status.' + STATUS_KEYS[s])}
              </option>
            ))}
          </select>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="all">{t('filters.product')}</option>
            <option value="AI_92">AI-92</option>
            <option value="AI_95">AI-95</option>
          </select>
          {showVehicleDriverFilters && (
            <>
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="all">{t('table.plate')}</option>
                {uniqueVehicles.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="all">{t('table.driver')}</option>
                {uniqueDrivers.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}
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
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canAssignOrUpdate && (
            <Button
              variant={statusFilter === 'CREATED' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() =>
                setStatusFilter((prev) => (prev === 'CREATED' ? 'all' : 'CREATED'))
              }
            >
              {t('newOrders')}
            </Button>
          )}
          {canExport && (
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          )}
          {canCreate && (
            <Button size="sm" asChild>
              <Link href={`/${locale}/dashboard/orders/new`}>
                <Plus className="h-4 w-4" />
                {t('create')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {filteredOrders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span>
            {t('totalOrders')}: <span className="font-semibold text-gray-900 dark:text-white">{filteredOrders.length}</span>
          </span>
          <span>
            {t('totalVolume')}: <span className="font-semibold text-gray-900 dark:text-white">{totalLiters} L</span>
          </span>
          {!isCompany && totalSum > 0 && (
            <span>
              {t('totalAmount')}:{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatUzs(totalSum)}
              </span>
            </span>
          )}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-premium flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6 rounded-2xl bg-primary-500/10 p-5">
            <Package className="h-14 w-14 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('empty.title')}</h3>
          <p className="mt-2 max-w-[280px] text-sm text-gray-500 dark:text-gray-400">{t('empty.desc')}</p>
          {canCreate && (
            <Button size="lg" className="mt-6" asChild>
              <Link href={`/${locale}/dashboard/orders/new`}>{t('create')}</Link>
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white dark:bg-primary-950/95 dark:backdrop-blur">
                <tr className="border-b border-gray-200/60 dark:border-white/[0.07]">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('table.date')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('table.time')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('table.plate')}
                  </th>
                  {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER') && (
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('table.driver')}
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('table.fuel')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('table.volume')}
                  </th>
                  {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER') && (
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('table.address')}
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('table.status')}
                  </th>
                  {canAssignOrUpdate && (
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('table.actions')}
                    </th>
                  )}
                  {isCourier && (
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Действия
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, i) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    className="group border-b border-gray-100/80 transition-colors last:border-0 hover:bg-gray-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString(
                        locale === 'uz' ? 'uz-UZ' : locale === 'en' ? 'en-US' : 'ru-RU',
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(order.createdAt).toLocaleTimeString(
                        locale === 'uz' ? 'uz-UZ' : locale === 'en' ? 'en-US' : 'ru-RU',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {order.plateNumber}
                    </td>
                    {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {order.driverName ?? '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {order.fuelType.replace('_', '-')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {order.volume} л
                    </td>
                    {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER') && (
                      <td className="max-w-[180px] truncate px-6 py-4 text-xs text-gray-500 dark:text-gray-400" title={order.address ?? undefined}>
                        {order.address ?? '—'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          order.status === 'CREATED' || order.status === 'RECEIVED'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : order.status === 'DELIVERED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : order.status === 'CANCELLED'
                                ? 'bg-gray-500/15 text-gray-600 dark:text-gray-400'
                                : 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        }`}
                      >
                        {t('status.' + (STATUS_KEYS[order.status] || order.status))}
                      </span>
                    </td>
                    {canAssignOrUpdate && (
                      <td className="px-6 py-4 text-right text-xs text-gray-600 dark:text-gray-300 space-x-1">
                        {order.status === 'CREATED' && (
                          <Button size="sm" variant="secondary" onClick={() => handleDispatcherStatus(order.id, 'RECEIVED')}>
                            {t('markReceived')}
                          </Button>
                        )}
                        {(order.status === 'RECEIVED' || order.status === 'CREATED') && (
                          <Button size="sm" variant="secondary" onClick={() => handleAssignCourier(order.id)}>
                            {t('assignCourier')}
                          </Button>
                        )}
                        {order.status === 'COURIER_ASSIGNED' && (
                          <Button size="sm" variant="secondary" onClick={() => handleDispatcherStatus(order.id, 'IN_DELIVERY')}>
                            {t('inDelivery')}
                          </Button>
                        )}
                        {order.status === 'IN_DELIVERY' && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => handleDispatcherStatus(order.id, 'DELIVERED')}>
                              {t('markDelivered')}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDispatcherStatus(order.id, 'CANCELLED')}>
                              {t('cancel')}
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                    {isCourier && (
                      <td className="px-6 py-4 text-right text-xs text-gray-600 dark:text-gray-300 space-y-1">
                        {order.address && (
                          <div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[11px] text-primary-600 dark:text-primary-400"
                              asChild
                            >
                              <a
                                href={`https://yandex.ru/maps/?text=${encodeURIComponent(order.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Открыть в навигаторе
                              </a>
                            </Button>
                          </div>
                        )}
                        <div className="space-x-1">
                          {order.status === 'COURIER_ASSIGNED' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCourierAction(order.id, 'ON_ROUTE')}
                            >
                              {t('inDelivery')}
                            </Button>
                          )}
                          {order.status === 'IN_DELIVERY' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCourierAction(order.id, 'DELIVERED')}
                            >
                              {t('markDelivered')}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
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
