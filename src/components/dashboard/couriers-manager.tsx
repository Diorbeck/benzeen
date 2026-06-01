'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bike, Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Courier = {
  id: string;
  name: string | null;
  phone: string | null;
  vehicleNumber: string | null;
};

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

const emptyForm = { name: '', phone: '', vehicleNumber: '', password: '' };

export function CouriersManager({ couriers }: { couriers: Courier[] }) {
  const router = useRouter();

  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editError, setEditError] = useState('');

  const create = async () => {
    if (!createForm.name.trim() || !createForm.phone.trim() || !createForm.password.trim()) {
      setCreateError('Заполните ФИО, телефон и пароль');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          phone: createForm.phone.trim(),
          vehicleNumber: createForm.vehicleNumber.trim() || undefined,
          password: createForm.password,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error || 'Не удалось создать курьера');
        return;
      }
      setCreateForm(emptyForm);
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (c: Courier) => {
    setEditingId(c.id);
    setEditError('');
    setEditForm({
      name: c.name ?? '',
      phone: c.phone ?? '',
      vehicleNumber: c.vehicleNumber ?? '',
      password: '',
    });
  };

  const save = async (id: string) => {
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      setEditError('ФИО и телефон обязательны');
      return;
    }
    setBusyId(id);
    setEditError('');
    try {
      const res = await fetch(`/api/couriers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          vehicleNumber: editForm.vehicleNumber.trim() || undefined,
          password: editForm.password.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || 'Не удалось сохранить');
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: Courier) => {
    if (!window.confirm(`Удалить курьера «${c.name || c.phone}»?`)) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/couriers/${c.id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-premium space-y-3 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Зарегистрировать курьера
        </h2>
        {createError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {createError}
          </p>
        )}
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              ФИО *
            </label>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Иванов Иван"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Номер машины
            </label>
            <input
              value={createForm.vehicleNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
              placeholder="01A123BC"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Номер телефона *
            </label>
            <input
              value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+998 90 000 00 00"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Пароль * (минимум 6 символов)
            </label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={create} disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? 'Добавление…' : 'Добавить курьера'}
          </Button>
        </div>
      </div>

      {editError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {editError}
        </p>
      )}

      {couriers.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Пока нет курьеров.</p>
      ) : (
        <div className="space-y-3">
          {couriers.map((c) => {
            const isEditing = editingId === c.id;
            const busy = busyId === c.id;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-premium overflow-hidden"
              >
                {isEditing ? (
                  <div className="space-y-3 p-5">
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                          ФИО *
                        </label>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                          Номер машины
                        </label>
                        <input
                          value={editForm.vehicleNumber}
                          onChange={(e) => setEditForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                          Номер телефона *
                        </label>
                        <input
                          value={editForm.phone}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                          Новый пароль (необязательно)
                        </label>
                        <input
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                          placeholder="Оставьте пустым, чтобы не менять"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditingId(null)} disabled={busy}>
                        <X className="h-4 w-4" />
                        Отмена
                      </Button>
                      <Button size="sm" onClick={() => save(c.id)} disabled={busy}>
                        <Check className="h-4 w-4" />
                        {busy ? 'Сохранение…' : 'Сохранить'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-primary-500/10 p-2.5">
                        <Bike className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">
                          {c.name || '—'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {c.phone || '—'}
                          {c.vehicleNumber ? ` · ${c.vehicleNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(c)}
                        disabled={busy}
                        className="text-gray-500 dark:text-gray-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(c)}
                        disabled={busy}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
