'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data: Notification[]) => {
        setItems(data);
        setUnread(data.filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  const markRead = async (ids?: string[]) => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-primary-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/10">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('title')}
              </span>
              {unread > 0 && (
                <button
                  onClick={() => markRead()}
                  className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  {t('markAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('empty')}
                </p>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'border-b border-gray-100 px-4 py-3 last:border-0 dark:border-white/5',
                      !n.read && 'bg-primary-500/5'
                    )}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {n.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
