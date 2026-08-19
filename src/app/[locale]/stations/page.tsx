import { B2CHeader } from '@/components/b2c/header';
import { StationsNearby } from '@/components/b2c/stations-nearby';

// Модуль 1 ТЗ v2: карта подключённых АЗС с остатками топлива по данным датчиков
// в резервуарах. Экран открывается сразу на карте, список заправок — ниже.
export default function StationsPage() {
  return (
    <div className="min-h-screen bg-canvas text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main>
        <StationsNearby />
      </main>
    </div>
  );
}
