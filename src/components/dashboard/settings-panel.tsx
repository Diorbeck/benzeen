'use client';

import { motion } from 'framer-motion';
import { User } from 'lucide-react';

export function SettingsPanel({ user }: { user?: { name?: string | null; email?: string | null; role?: string } | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-white/5"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-primary-500/10 p-3">
          <User className="h-6 w-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{user?.name || 'Пользователь'}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Роль: {user?.role}</p>
        </div>
      </div>
    </motion.div>
  );
}
