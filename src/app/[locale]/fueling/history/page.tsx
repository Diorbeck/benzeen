import { B2CHeader } from '@/components/b2c/header';
import { FuelingHistory } from '@/components/b2c/fueling-history';

// История заправок с чеками — Модуль 2 ТЗ v2.
export default function FuelingHistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main>
        <FuelingHistory />
      </main>
    </div>
  );
}
