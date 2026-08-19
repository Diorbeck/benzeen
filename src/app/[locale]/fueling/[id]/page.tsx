import { B2CHeader } from '@/components/b2c/header';
import { FuelingLive } from '@/components/b2c/fueling-live';
import { StationFuelingAppOnly } from '@/components/b2c/app-only-notice';
import { STATION_FUELING_WEB_ENABLED } from '@/lib/features';

// Живой экран заправки: литры и сумма с колонки в реальном времени (Модуль 2).
// В браузере выключен тем же флагом, что и подтверждение заправки.
export default async function FuelingLivePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return (
    <div className="min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main>
        {STATION_FUELING_WEB_ENABLED ? (
          <FuelingLive sessionId={id} />
        ) : (
          <StationFuelingAppOnly locale={locale} />
        )}
      </main>
    </div>
  );
}
