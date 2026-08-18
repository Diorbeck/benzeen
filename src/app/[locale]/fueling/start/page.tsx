import { B2CHeader } from '@/components/b2c/header';
import { FuelingStart } from '@/components/b2c/fueling-start';

// Подтверждение заправки: АЗС → колонка → топливо → объём → резерв (Модули 3 и 4).
export default function FuelingStartPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-navy dark:bg-navy-950 dark:text-white">
      <B2CHeader />
      <main>
        <FuelingStart />
      </main>
    </div>
  );
}
