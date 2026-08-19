import { B2CHeader } from '@/components/b2c/header';
import { FuelingStart } from '@/components/b2c/fueling-start';
import { StationFuelingAppOnly } from '@/components/b2c/app-only-notice';
import { STATION_FUELING_WEB_ENABLED } from '@/lib/features';

// Подтверждение заправки: АЗС → колонка → топливо → объём → резерв (Модули 3 и 4).
// В браузере сценарий выключен флагом — заливка на АЗС идёт из приложения.
export default async function FuelingStartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main>
        {STATION_FUELING_WEB_ENABLED ? <FuelingStart /> : <StationFuelingAppOnly locale={locale} />}
      </main>
    </div>
  );
}
