import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUzs(amount: number): string {
  return (
    new Intl.NumberFormat('uz-UZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' UZS'
  );
}

/** Progress bar color by usage ratio: green < 70%, yellow 70-90%, red > 90% */
export function getProgressColor(used: number, limit: number): 'success' | 'warning' | 'danger' {
  if (limit <= 0) return 'success';
  const ratio = used / limit;
  if (ratio >= 0.9) return 'danger';
  if (ratio >= 0.7) return 'warning';
  return 'success';
}
