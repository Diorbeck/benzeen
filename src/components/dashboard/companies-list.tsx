'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, ChevronDown, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Car = {
  id: string;
  plateNumber: string;
  model: string | null;
  fuelType: string;
  usedLiters: number;
  limit: number;
};

type Company = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  telegram: string | null;
  carsCount: number;
  cars: Car[];
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

export function CompaniesList({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', address: '', phone: '', telegram: '' });

  const startEdit = (c: Company) => {
    setEditingId(c.id);
    setExpanded(c.id);
    setError('');
    setForm({
      name: c.name,
      address: c.address ?? '',
      phone: c.phone ?? '',
      telegram: c.telegram ?? '',
    });
  };

  const save = async (id: string) => {
    if (!form.name.trim()) {
      setError('Введите название компании');
      return;
    }
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          telegram: form.telegram.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError('Не удалось сохранить изменения');
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: Company) => {
    if (
      !window.confirm(
        `Удалить компанию «${c.name}»? Все её машины, водители и заказы будут удалены безвозвратно.`,
      )
    )
      return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/companies/${c.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Не удалось удалить компанию');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (companies.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Пока нет ни одной компании.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {companies.map((company) => {
        const isOpen = expanded === company.id;
        const isEditing = editingId === company.id;
        const busy = busyId === company.id;
        return (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 p-5">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : company.id)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <div className="rounded-xl bg-primary-500/10 p-2.5">
                  <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {company.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Машин: {company.carsCount}
                    {company.phone ? ` · ${company.phone}` : ''}
                  </p>
                </div>
                <ChevronDown
                  className={`ml-auto h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(company)}
                  disabled={busy}
                  className="text-gray-500 dark:text-gray-400"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(company)}
                  disabled={busy}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isEditing && (
              <div className="border-t border-gray-100 p-5 dark:border-white/10">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                      Название *
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                      Адрес
                    </label>
                    <input
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                      Телефон
                    </label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                      Telegram
                    </label>
                    <input
                      value={form.telegram}
                      onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditingId(null)} disabled={busy}>
                    <X className="h-4 w-4" />
                    Отмена
                  </Button>
                  <Button size="sm" onClick={() => save(company.id)} disabled={busy}>
                    <Check className="h-4 w-4" />
                    {busy ? 'Сохранение…' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            )}

            {isOpen && !isEditing && (
              <div className="border-t border-gray-100 p-5 dark:border-white/10">
                {company.cars.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    В этой компании пока нет машин.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2">Машина</th>
                          <th className="px-4 py-2">Модель</th>
                          <th className="px-4 py-2">Топливо</th>
                          <th className="px-4 py-2">Расход, л</th>
                          <th className="px-4 py-2">Лимит, л</th>
                        </tr>
                      </thead>
                      <tbody>
                        {company.cars.map((car) => (
                          <tr
                            key={car.id}
                            className="border-t border-gray-100 text-gray-700 dark:border-white/[0.06] dark:text-gray-200"
                          >
                            <td className="px-4 py-2 font-medium">{car.plateNumber}</td>
                            <td className="px-4 py-2">{car.model || '—'}</td>
                            <td className="px-4 py-2">{car.fuelType.replace('_', '-')}</td>
                            <td className="px-4 py-2">{car.usedLiters}</td>
                            <td className="px-4 py-2">{car.limit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
