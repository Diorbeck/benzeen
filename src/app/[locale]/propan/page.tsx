import { getTranslations } from 'next-intl/server';
import { B2CHeader } from '@/components/b2c/header';
import { PropaneNearby } from '@/components/b2c/propane-nearby';

export default async function PropanPage() {
  const t = await getTranslations('propan');

  return (
    <div className="min-h-screen bg-gray-50 text-navy">
      <B2CHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t('subtitle')}</p>
        <div className="mt-6">
          <PropaneNearby />
        </div>
      </main>
    </div>
  );
}
