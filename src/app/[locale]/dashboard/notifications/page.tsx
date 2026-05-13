import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Bell } from 'lucide-react';
import { NotificationsList } from '@/components/dashboard/notifications-list';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations('notifications');

  const items = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
      </div>

      <div className="card-premium overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="mb-6 h-14 w-14 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-400">{t('empty')}</p>
            <p className="mt-3 max-w-sm text-sm text-gray-500 dark:text-gray-500">{t('emptyHint')}</p>
          </div>
        ) : (
          <NotificationsList initialItems={items} />
        )}
      </div>
    </div>
  );
}
