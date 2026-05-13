'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type Item = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
};

export function NotificationsList({ initialItems }: { initialItems: Item[] }) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/10">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('title')}</span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            {t('markAllRead')}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-white/5">
        {items.map((n) => (
          <li
            key={n.id}
            className={`px-6 py-4 ${!n.read ? 'bg-primary-500/5 dark:bg-primary-500/10' : ''}`}
          >
            <p className="font-medium text-gray-900 dark:text-white">{n.title}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
