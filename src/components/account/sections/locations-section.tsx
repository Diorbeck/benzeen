'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AccountLocation, cardCls, inputCls } from '@/components/account/shared';

// Локации: saved delivery addresses (max 3, enforced server-side).
export function LocationsSection({ locations }: { locations: AccountLocation[] }) {
  const t = useTranslations('account');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const rename = async (id: string) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/account/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    }
  };
  const del = async (id: string) => {
    const res = await fetch(`/api/account/locations/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  };

  return (
    <section className={cardCls}>
      <div className="mb-4 flex items-center gap-2.5">
        <MapPin className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden />
        <h2 className="text-base font-semibold text-navy dark:text-white">{t('locations.title')}</h2>
      </div>
      {locations.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('locations.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {locations.map((l) =>
            editingId === l.id ? (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} max-w-[12rem]`}
                  value={editName}
                  maxLength={40}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <Button type="button" size="sm" className="rounded-control" onClick={() => rename(l.id)} disabled={!editName.trim()}>
                  {t('locations.save')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-control text-gray-600 dark:text-gray-300"
                  onClick={() => setEditingId(null)}
                >
                  {t('locations.cancel')}
                </Button>
              </li>
            ) : (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-control border border-gray-200 dark:border-white/10 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium text-navy dark:text-white">{l.name}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(l.id);
                      setEditName(l.name);
                    }}
                    className="rounded-control p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-primary-600"
                    aria-label={t('locations.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => del(l.id)}
                    className="rounded-control p-2 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={t('locations.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{t('locations.hint')}</p>
    </section>
  );
}
