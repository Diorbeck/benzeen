'use client';

import dynamic from 'next/dynamic';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'framer-motion';
import { QueryProvider } from './query-provider';

const RouteProgress = dynamic(() => import('./route-progress').then((m) => ({ default: m.RouteProgress })), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="benzeen-theme">
        {/* All framer-motion animation collapses to instant when the OS asks for reduced motion. */}
        <MotionConfig reducedMotion="user">
          <RouteProgress />
          <QueryProvider>{children}</QueryProvider>
        </MotionConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
