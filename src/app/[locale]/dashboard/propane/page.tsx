import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { PropanePointsAdmin } from '@/components/dashboard/propane-points-admin';

export default async function PropanePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${locale}/login`);

  const { role } = session.user as { role?: string };
  if (role !== 'SUPER_ADMIN' && role !== 'PROPANE_OPERATOR') {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations('dashboard.propane');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-navy dark:text-white">
        {t('title')}
      </h1>
      <PropanePointsAdmin isAdmin={role === 'SUPER_ADMIN'} />
    </div>
  );
}
