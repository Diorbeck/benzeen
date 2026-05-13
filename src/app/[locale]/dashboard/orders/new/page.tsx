import { CreateOrderForm } from '@/components/dashboard/create-order-form';

export default function NewOrderPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Создать заказ
      </h1>
      <CreateOrderForm />
    </div>
  );
}
