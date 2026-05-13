'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import nprogress from 'nprogress';

if (typeof window !== 'undefined') {
  nprogress.configure({ showSpinner: false, minimum: 0.08, trickleSpeed: 200 });
}

export function RouteProgress() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    nprogress.done();
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target?.href && target.href.startsWith(window.location.origin) && !target.target && target.getAttribute('href')?.startsWith('/')) {
        nprogress.start();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
