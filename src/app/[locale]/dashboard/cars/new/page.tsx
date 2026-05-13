import { AddCarForm } from '@/components/dashboard/add-car-form';

export default function NewCarPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Добавить машину
      </h1>
      <AddCarForm />
    </div>
  );
}
