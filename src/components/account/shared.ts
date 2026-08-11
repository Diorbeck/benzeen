// Shared types + styles for the Кабинет 2.0 tabbed account view.

export type FuelType = 'AI_92' | 'AI_95' | 'AI_100';

export type AccountOrder = {
  id: string;
  status: string;
  fuelType: string;
  volume: number;
  dispensedVolume: number | null;
  totalAmount: number | null;
  clientCarId: string | null;
  scheduledFor: string | null;
  createdAt: string;
};

export type AccountCar = {
  id: string;
  plate: string;
  model: string | null;
  tankCapacity: number | null;
  brand: string | null;
  color: string | null;
  fuelType: FuelType | null;
  oilType: string | null;
  photoUrl: string | null;
};

export type AccountLocation = { id: string; name: string; lat: number; lng: number };

export type ReferralStats = {
  code: string;
  balance: number;
  friendCount: number;
  milestoneAt: number;
  ledger: { id: string; liters: number; reason: string; createdAt: string }[];
};

export type AccountTab = 'profile' | 'cars' | 'payment' | 'locations' | 'history' | 'support';

export const FUEL_LABEL: Record<string, string> = { AI_92: 'АИ-92', AI_95: 'АИ-95', AI_100: 'АИ-100' };

export const inputCls =
  'h-12 w-full rounded-control border border-gray-300 dark:border-white/15 bg-white dark:bg-navy-800 px-4 py-3 text-navy dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600';

export const cardCls =
  'rounded-card border border-gray-200/60 dark:border-white/10 bg-white dark:bg-navy-900 p-5 shadow-soft dark:shadow-none sm:p-6';
